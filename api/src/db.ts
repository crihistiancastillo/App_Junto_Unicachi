/**
 * Acceso a datos con dos motores intercambiables:
 *  - PostgreSQL real (node-postgres) cuando existe DATABASE_URL (Docker o servidor propio).
 *  - PostgreSQL embebido (PGlite) cuando no existe: se instala con npm, guarda los
 *    datos en la carpeta .junto-db y carga el esquema y los datos demo la primera vez.
 * El resto de la API solo usa query / one / tx, así que no sabe cuál está activo.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { config } from "./config.js";

export type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
export type Client = Db & { release: () => void };
type Driver = Db & { connect: () => Promise<Client>; end: () => Promise<void>; nombre: string };

// NUMERIC llega como string: lo convertimos a number (montos < 2^53, suficiente aquí).
pg.types.setTypeParser(1700, (v) => Number(v));

function driverPostgres(url: string): Driver {
  const p = new pg.Pool({ connectionString: url, max: 10 });
  return {
    nombre: "PostgreSQL",
    query: (sql, params) => p.query(sql, params as any[]),
    connect: () => p.connect() as unknown as Promise<Client>,
    end: () => p.end(),
  };
}

// ---------- PGlite: conversión de tipos para igualar a node-postgres ----------
const ARRAY_OIDS = new Set([1007, 1009, 1015, 2951, 1016]); // int4[], text[], varchar[], uuid[], int8[]
const JSON_OIDS = new Set([114, 3802]);

/** Parser mínimo de arrays de Postgres: {a,b,"c d"} -> ["a","b","c d"] */
export function parsePgArray(s: string): (string | null)[] {
  const inner = s.slice(1, -1);
  if (!inner) return [];
  const out: (string | null)[] = [];
  let cur = "", quoted = false, inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inQuotes) {
      if (c === "\\") cur += inner[++i];
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') { inQuotes = true; quoted = true; }
    else if (c === ",") { out.push(!quoted && cur === "NULL" ? null : cur); cur = ""; quoted = false; }
    else cur += c;
  }
  out.push(!quoted && cur === "NULL" ? null : cur);
  return out;
}

function normalizar(rows: any[], fields: { name: string; dataTypeID: number }[]) {
  for (const f of fields) {
    for (const r of rows) {
      const v = r[f.name];
      if (v == null) continue;
      if (f.dataTypeID === 1700 && typeof v === "string") r[f.name] = Number(v);
      else if (ARRAY_OIDS.has(f.dataTypeID) && typeof v === "string" && v.startsWith("{")) r[f.name] = parsePgArray(v);
      else if (JSON_OIDS.has(f.dataTypeID) && typeof v === "string") r[f.name] = JSON.parse(v);
    }
  }
  return rows;
}

async function driverEmbebido(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.resolve(config.embeddedDir);
  const nueva = !existsSync(dir);
  const db = new PGlite(dir);
  await db.waitReady;
  if (nueva) {
    console.log(`[db] Creando base embebida en ${dir} con los datos demo…`);
    for (const f of ["01_schema.sql", "02_seed_demo.sql"]) {
      await db.exec(readFileSync(path.resolve(config.sqlDir, f), "utf8"));
    }
  }

  // PGlite tiene una sola conexión: las transacciones se serializan con una cola.
  let cola: Promise<void> = Promise.resolve();
  const turno = async () => {
    let liberar!: () => void;
    const siguiente = new Promise<void>((r) => (liberar = r));
    const anterior = cola;
    cola = cola.then(() => siguiente);
    await anterior;
    return liberar;
  };
  const crudo = async (sql: string, params: unknown[] = []) => {
    const r: any = await db.query(sql, params as any[]);
    return { rows: normalizar(r.rows, r.fields ?? []) };
  };

  return {
    nombre: "PostgreSQL embebido (PGlite)",
    query: async (sql, params) => {
      const liberar = await turno();
      try { return await crudo(sql, params); } finally { liberar(); }
    },
    connect: async () => {
      const liberar = await turno();
      return { query: crudo, release: liberar };
    },
    end: () => db.close(),
  };
}

const driverListo: Promise<Driver> = config.databaseUrl
  ? Promise.resolve(driverPostgres(config.databaseUrl))
  : driverEmbebido();
driverListo.then((d) => console.log(`[db] Usando ${d.nombre}`)).catch((e) => {
  console.error("[db] No se pudo iniciar la base de datos:", e);
  process.exit(1);
});

/** Cliente de la transacción en curso: las consultas dentro de tx() lo usan solas. */
const txActual = new AsyncLocalStorage<Client>();

export const pool: Driver = {
  nombre: "pool",
  query: async (sql, params) => (txActual.getStore() ?? (await driverListo)).query(sql, params),
  connect: async () => (await driverListo).connect(),
  end: async () => (await driverListo).end(),
};

export async function query<T = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query(sql, params);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

/** Ejecuta fn dentro de una transacción; hace ROLLBACK ante cualquier error. */
export async function tx<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await txActual.run(client, () => fn(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Ejecuta fn fuera de cualquier transacción (para trabajo diferido como los push). */
export const fueraDeTx = <T>(fn: () => T) => txActual.exit(fn);
