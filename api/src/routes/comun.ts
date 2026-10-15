import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { one, query, tx } from "../db.js";
import { autenticar, requiereRol } from "../middleware/auth.js";
import { conflict, h, HttpError, notFound } from "../middleware/errors.js";
import { ml } from "../services/ml.js";

export const publicRouter = Router();
export const comunRouter = Router();
export const adminRouter = Router();

const POLITICA_VIGENTE = "2026.1";

// ---------- Iniciar sesión (modo demo) -------------------------------------
// En producción la app inicia sesión con Firebase Auth y envía el ID token;
// este endpoint solo existe para probar la app con la base demo.
publicRouter.post("/auth/demo-login", h(async (req, res) => {
  if (!config.demoMode) throw notFound("El recurso");
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const u = await one(
    `SELECT u.id, u.nombre, u.email, u.rol, c.zona_id FROM usuario u
     LEFT JOIN comerciante c ON c.usuario_id = u.id WHERE lower(u.email) = lower($1)`,
    [email],
  );
  if (!u) throw new HttpError(401, "No encontramos una cuenta con ese correo.");
  res.json({ token: `demo:${u.id}`, usuario: u });
}));

// ---------- Registro con Firebase ------------------------------------------
publicRouter.post("/auth/registro", autenticar({ permitirSinRegistro: true }), h(async (req, res) => {
  if (req.user) throw conflict("Esta cuenta ya está registrada.");
  const base = z.object({
    nombre: z.string().min(2),
    email: z.string().email(),
    telefono: z.string().min(6),
    acepta_politica_datos: z.literal(true, { errorMap: () => ({ message: "Debes aceptar la política de datos (Ley N.º 29733)." }) }),
  });
  const ruc = z.string().regex(/^(10|20)\d{9}$/, "RUC inválido");
  const body = z.discriminatedUnion("rol", [
    base.extend({
      rol: z.literal("COMERCIANTE"), ruc, razon_social: z.string().min(2), nombre_comercial: z.string().optional(),
      tipo_negocio: z.enum(["BODEGA", "PUESTO_MERCADO"]), es_mype: z.boolean().default(true),
      direccion: z.string().min(5), latitud: z.number(), longitud: z.number(),
    }),
    base.extend({ rol: z.literal("MAYORISTA"), ruc, razon_social: z.string().min(2), direccion_almacen: z.string().min(5) }),
  ]).parse(req.body);

  const usuario = await tx(async (db) => {
    const u = await one(
      "INSERT INTO usuario (firebase_uid, nombre, email, telefono, rol, estado) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [req.firebaseUid, body.nombre, body.email, body.telefono, body.rol,
       body.rol === "MAYORISTA" ? "PENDIENTE_VERIFICACION" : "ACTIVA"],
      db,
    );
    if (body.rol === "COMERCIANTE") {
      // Asigna la zona activa más cercana al negocio.
      const zona = await one(
        `SELECT id FROM zona WHERE activa ORDER BY
           (latitud - $1) ^ 2 + ((longitud - $2) * cos(radians($1))) ^ 2 LIMIT 1`,
        [body.latitud, body.longitud],
        db,
      );
      if (!zona) throw new HttpError(400, "Aún no operamos en tu zona.");
      await db.query(
        `INSERT INTO comerciante (usuario_id, ruc, razon_social, nombre_comercial, tipo_negocio, es_mype, direccion, latitud, longitud, zona_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [u.id, body.ruc, body.razon_social, body.nombre_comercial ?? null, body.tipo_negocio, body.es_mype,
         body.direccion, body.latitud, body.longitud, zona.id],
      );
    } else {
      await db.query("INSERT INTO mayorista (usuario_id, ruc, razon_social, direccion_almacen) VALUES ($1,$2,$3,$4)",
        [u.id, body.ruc, body.razon_social, body.direccion_almacen]);
    }
    await db.query(
      "INSERT INTO consentimiento_datos (usuario_id, finalidad, version_politica) VALUES ($1, $2, $3)",
      [u.id, "Gestión de compras colectivas y notificaciones", POLITICA_VIGENTE],
    );
    return u;
  });
  res.status(201).json(usuario);
}));

// ---------- Perfil ---------------------------------------------------------
comunRouter.get("/me", h(async (req, res) => {
  const me = req.user!;
  const perfil = await one(
    `SELECT u.id, u.nombre, u.email, u.telefono, u.rol, u.estado, u.fecha_registro,
            c.ruc AS c_ruc, c.razon_social AS c_razon, c.nombre_comercial, c.tipo_negocio, c.es_mype, c.direccion,
            c.zona_id, z.nombre AS zona, z.distrito,
            m.ruc AS m_ruc, m.razon_social AS m_razon, m.direccion_almacen
     FROM usuario u LEFT JOIN comerciante c ON c.usuario_id = u.id LEFT JOIN zona z ON z.id = c.zona_id
     LEFT JOIN mayorista m ON m.usuario_id = u.id WHERE u.id = $1`,
    [me.id],
  );
  const { c_ruc, m_ruc, c_razon, m_razon, ...resto } = perfil;
  res.json({ ...resto, ruc: c_ruc ?? m_ruc, razon_social: c_razon ?? m_razon });
}));

comunRouter.patch("/me", h(async (req, res) => {
  const b = z.object({ nombre: z.string().min(2).optional(), telefono: z.string().min(6).optional() }).parse(req.body);
  res.json(await one(
    "UPDATE usuario SET nombre = COALESCE($2, nombre), telefono = COALESCE($3, telefono) WHERE id = $1 RETURNING id, nombre, telefono",
    [req.user!.id, b.nombre ?? null, b.telefono ?? null],
  ));
}));

comunRouter.post("/me/dispositivos", h(async (req, res) => {
  const b = z.object({ fcm_token: z.string().min(10), plataforma: z.enum(["ios", "android", "web"]) }).parse(req.body);
  await query(
    `INSERT INTO dispositivo (usuario_id, fcm_token, plataforma) VALUES ($1, $2, $3)
     ON CONFLICT (fcm_token) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, actualizado = now()`,
    [req.user!.id, b.fcm_token, b.plataforma],
  );
  res.status(204).end();
}));

comunRouter.get("/me/consentimientos", h(async (req, res) => {
  res.json(await query("SELECT * FROM consentimiento_datos WHERE usuario_id = $1 ORDER BY fecha_aceptacion DESC", [req.user!.id]));
}));

comunRouter.post("/me/consentimientos/:id/revocar", h(async (req, res) => {
  const c = await one(
    `UPDATE consentimiento_datos SET revocado = true, fecha_revocacion = now()
     WHERE id = $1 AND usuario_id = $2 AND NOT revocado RETURNING *`,
    [req.params.id, req.user!.id],
  );
  if (!c) throw notFound("El consentimiento");
  res.json(c);
}));

// ---------- Zonas / comunidades -------------------------------------------
comunRouter.get("/zonas", h(async (req, res) => {
  res.json(await query(
    `SELECT z.id, z.nombre, z.distrito, z.latitud, z.longitud,
            (SELECT count(*) FROM comerciante c WHERE c.zona_id = z.id)::int AS miembros,
            (SELECT count(*) FROM pedido_grupal pg WHERE pg.zona_id = z.id AND pg.estado = 'ABIERTO')::int AS pedidos_activos,
            (SELECT array_agg(u.nombre) FROM (SELECT u.nombre FROM comerciante c JOIN usuario u ON u.id = c.usuario_id
               WHERE c.zona_id = z.id LIMIT 5) u) AS nombres,
            COALESCE(z.id = $1::uuid, false) AS es_mia, z.activa
     FROM zona z WHERE z.activa OR $2 ORDER BY COALESCE(z.id = $1::uuid, false) DESC, z.nombre`,
    [req.user!.zona_id, req.user!.rol === "ADMINISTRADOR"],
  ));
}));

// ---------- Recibir notificaciones ----------------------------------------
comunRouter.get("/notificaciones", h(async (req, res) => {
  res.json(await query(
    "SELECT * FROM notificacion WHERE usuario_id = $1 ORDER BY fecha_envio DESC LIMIT 50", [req.user!.id],
  ));
}));

comunRouter.post("/notificaciones/leer-todas", h(async (req, res) => {
  await query("UPDATE notificacion SET leida = true WHERE usuario_id = $1 AND NOT leida", [req.user!.id]);
  res.status(204).end();
}));

// ---------- Administrador -------------------------------------------------
adminRouter.use(requiereRol("ADMINISTRADOR"));

adminRouter.get("/admin/indicadores", h(async (_req, res) => {
  const mensual = await query("SELECT * FROM v_indicadores ORDER BY periodo DESC LIMIT 12");
  const global = await one(
    `SELECT round(avg(pc.porcentaje_descuento) FILTER (WHERE pc.estado = 'ACEPTADO'), 2) AS descuento_promedio,
            round((avg(extract(epoch FROM pg.fecha_cierre - pg.fecha_creacion)) / 3600)::numeric, 1) AS horas_promedio_armado,
            count(DISTINCT pg.id) FILTER (WHERE pg.estado = 'ENTREGADO')::int AS pedidos_completados,
            (SELECT COALESCE(SUM(monto_bruto - monto_neto), 0) FROM pedido_consolidado WHERE estado = 'ACEPTADO') AS ahorro_total,
            (SELECT count(*) FROM comerciante)::int AS comercios,
            (SELECT count(*) FROM usuario WHERE rol = 'MAYORISTA' AND estado = 'PENDIENTE_VERIFICACION')::int AS mayoristas_por_verificar
     FROM pedido_grupal pg LEFT JOIN pedido_consolidado pc ON pc.id = pg.pedido_consolidado_id`,
  );
  const porZona = await query(
    `SELECT z.nombre, count(pg.id)::int AS pedidos,
            round(avg(pc.porcentaje_descuento) FILTER (WHERE pc.estado = 'ACEPTADO'), 1) AS descuento_promedio
     FROM zona z LEFT JOIN pedido_grupal pg ON pg.zona_id = z.id
     LEFT JOIN pedido_consolidado pc ON pc.id = pg.pedido_consolidado_id
     GROUP BY z.id ORDER BY pedidos DESC`,
  );
  res.json({ global, mensual, por_zona: porZona });
}));

adminRouter.get("/admin/comercios", h(async (req, res) => {
  const rol = (req.query.rol as string) ?? null;
  res.json(await query(
    `SELECT u.id, u.nombre, u.email, u.rol, u.estado, u.fecha_registro,
            COALESCE(c.nombre_comercial, m.razon_social) AS negocio, COALESCE(c.ruc, m.ruc) AS ruc, z.nombre AS zona, c.es_mype
     FROM usuario u LEFT JOIN comerciante c ON c.usuario_id = u.id LEFT JOIN zona z ON z.id = c.zona_id
     LEFT JOIN mayorista m ON m.usuario_id = u.id
     WHERE u.rol <> 'ADMINISTRADOR' AND ($1::rol_usuario IS NULL OR u.rol = $1)
     ORDER BY (u.estado = 'PENDIENTE_VERIFICACION') DESC, u.nombre`,
    [rol],
  ));
}));

adminRouter.patch("/admin/usuarios/:id", h(async (req, res) => {
  const { estado } = z.object({ estado: z.enum(["ACTIVA", "SUSPENDIDA"]) }).parse(req.body);
  const u = await one("UPDATE usuario SET estado = $2 WHERE id = $1 AND rol <> 'ADMINISTRADOR' RETURNING id, nombre, estado",
    [req.params.id, estado]);
  if (!u) throw notFound("El usuario");
  res.json(u);
}));

const zonaSchema = z.object({
  nombre: z.string().min(3), distrito: z.string().min(3),
  latitud: z.number().min(-90).max(90), longitud: z.number().min(-180).max(180),
  radio_km: z.number().positive().max(20).default(1.5), activa: z.boolean().default(true),
});

adminRouter.post("/admin/zonas", h(async (req, res) => {
  const z1 = zonaSchema.parse(req.body);
  res.status(201).json(await one(
    "INSERT INTO zona (nombre, distrito, latitud, longitud, radio_km, activa) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [z1.nombre, z1.distrito, z1.latitud, z1.longitud, z1.radio_km, z1.activa],
  ));
}));

adminRouter.patch("/admin/zonas/:id", h(async (req, res) => {
  const b = zonaSchema.partial().parse(req.body);
  const actual = await one("SELECT * FROM zona WHERE id = $1", [req.params.id]);
  if (!actual) throw notFound("La zona");
  const m = { ...actual, ...b };
  res.json(await one(
    "UPDATE zona SET nombre=$2, distrito=$3, latitud=$4, longitud=$5, radio_km=$6, activa=$7 WHERE id=$1 RETURNING *",
    [req.params.id, m.nombre, m.distrito, m.latitud, m.longitud, m.radio_km, m.activa],
  ));
}));

adminRouter.post("/admin/ml/entrenar", h(async (_req, res) => {
  res.json(await ml.entrenar());
}));
