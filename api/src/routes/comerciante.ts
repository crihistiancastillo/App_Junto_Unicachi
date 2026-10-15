import { Router } from "express";
import { z } from "zod";
import { one, query, tx } from "../db.js";
import { ETIQUETA_ESTADO, progreso, type EstadoPedido } from "../domain/orderState.js";
import { siguienteTramo, type Tramo } from "../domain/pricing.js";
import { requiereRol } from "../middleware/auth.js";
import { conflict, forbidden, h, HttpError, notFound } from "../middleware/errors.js";
import { cerrarPedido, pagarParticipacion } from "../services/flows.js";
import { ml } from "../services/ml.js";
import { notificar } from "../services/notifications.js";

export const comercianteRouter = Router();
const soloComerciante = requiereRol("COMERCIANTE");

// Consulta base: pedido grupal + producto principal + avance + participantes
const SQL_PEDIDOS = `
  SELECT pg.id, pg.codigo, pg.estado, pg.meta_unidades, pg.fecha_creacion, pg.fecha_limite, pg.fecha_cierre,
         pg.nota, pg.zona_id, z.nombre AS zona, pg.mayorista_id, m.razon_social AS mayorista,
         pg.creador_id, pg.pedido_consolidado_id,
         COALESCE(SUM(i.cantidad), 0)::int AS unidades,
         COUNT(DISTINCT pa.comerciante_id)::int AS participantes,
         COALESCE(array_agg(DISTINCT u.nombre) FILTER (WHERE u.nombre IS NOT NULL), '{}') AS nombres,
         (array_agg(pr.id ORDER BY i.cantidad DESC))[1] AS producto_id,
         (array_agg(pr.nombre ORDER BY i.cantidad DESC))[1] AS producto,
         (array_agg(pr.unidad_medida ORDER BY i.cantidad DESC))[1] AS unidad_medida,
         (array_agg(pr.precio_unitario ORDER BY i.cantidad DESC))[1] AS precio_lista,
         (array_agg(pr.imagen_url ORDER BY i.cantidad DESC))[1] AS imagen_url
  FROM pedido_grupal pg
  JOIN zona z ON z.id = pg.zona_id
  JOIN mayorista m ON m.usuario_id = pg.mayorista_id
  LEFT JOIN participacion pa ON pa.pedido_grupal_id = pg.id
  LEFT JOIN usuario u ON u.id = pa.comerciante_id
  LEFT JOIN item_pedido i ON i.participacion_id = pa.id
  LEFT JOIN producto pr ON pr.id = i.producto_id`;
const GROUP = " GROUP BY pg.id, z.nombre, m.razon_social";

async function tramosDe(productoIds: string[]) {
  const rows = await query<Tramo & { producto_id: string }>(
    "SELECT * FROM descuento_volumen WHERE producto_id = ANY($1::uuid[]) ORDER BY cantidad_minima",
    [productoIds],
  );
  const map: Record<string, Tramo[]> = {};
  for (const t of rows) (map[t.producto_id] ??= []).push(t);
  return map;
}

/** Agrega campos calculados que la app muestra en las tarjetas. */
async function enriquecer(pedidos: any[]) {
  const tramos = await tramosDe(pedidos.map((p) => p.producto_id).filter(Boolean));
  return pedidos.map((p) => {
    const t = tramos[p.producto_id] ?? [];
    const mejor = t.reduce((m, x) => Math.max(m, Number(x.porcentaje)), 0);
    return {
      ...p,
      etiqueta_estado: ETIQUETA_ESTADO[p.estado as EstadoPedido],
      progreso: progreso(p.estado, p.unidades, p.meta_unidades),
      descuento_maximo: mejor,
      precio_meta: p.precio_lista ? Math.round(p.precio_lista * (1 - mejor / 100) * 100) / 100 : null,
      siguiente_tramo: siguienteTramo(t, p.unidades),
      tramos: t.map(({ cantidad_minima, cantidad_maxima, porcentaje }) => ({ cantidad_minima, cantidad_maxima, porcentaje })),
    };
  });
}

// ---------- Resumen de inicio -----------------------------------------------
comercianteRouter.get("/comerciante/resumen", soloComerciante, h(async (req, res) => {
  const me = req.user!;
  const r = await one(
    `SELECT
       (SELECT COALESCE(SUM(i.cantidad * (pr.precio_unitario - i.precio_unitario)), 0)
          FROM participacion pa JOIN item_pedido i ON i.participacion_id = pa.id
          JOIN producto pr ON pr.id = i.producto_id
          JOIN pedido_grupal pg ON pg.id = pa.pedido_grupal_id
         WHERE pa.comerciante_id = $1 AND pg.estado IN ('PAGADO','EN_REPARTO','ENTREGADO')
           AND pa.fecha_union >= date_trunc('month', now()) - interval '1 month') AS ahorro,
       (SELECT count(*) FROM participacion pa JOIN pedido_grupal pg ON pg.id = pa.pedido_grupal_id
         WHERE pa.comerciante_id = $1 AND pg.estado NOT IN ('ENTREGADO','CANCELADO'))::int AS activos,
       (SELECT count(*) FROM comerciante WHERE zona_id = $2 AND usuario_id <> $1)::int AS aliados,
       (SELECT count(*) FROM pedido_grupal WHERE zona_id = $2 AND estado = 'ABIERTO')::int AS oportunidades`,
    [me.id, me.zona_id],
  );
  res.json(r);
}));

// ---------- Catálogo del mayorista -----------------------------------------
comercianteRouter.get("/mayoristas", h(async (_req, res) => {
  res.json(await query(
    `SELECT m.usuario_id AS id, m.razon_social, count(p.id)::int AS productos
     FROM mayorista m JOIN usuario u ON u.id = m.usuario_id AND u.estado = 'ACTIVA'
     LEFT JOIN producto p ON p.mayorista_id = m.usuario_id AND p.activo GROUP BY 1, 2 ORDER BY 2`,
  ));
}));

comercianteRouter.get("/productos", h(async (req, res) => {
  const { mayorista_id, categoria, q } = req.query as Record<string, string | undefined>;
  const productos = await query(
    `SELECT p.*, m.razon_social AS mayorista FROM producto p
     JOIN mayorista m ON m.usuario_id = p.mayorista_id
     WHERE p.activo AND ($1::uuid IS NULL OR p.mayorista_id = $1)
       AND ($2::text IS NULL OR p.categoria = $2)
       AND ($3::text IS NULL OR p.nombre ILIKE '%' || $3 || '%')
     ORDER BY p.categoria, p.nombre`,
    [mayorista_id ?? null, categoria ?? null, q ?? null],
  );
  const tramos = await tramosDe(productos.map((p) => p.id));
  res.json(productos.map((p) => ({ ...p, tramos: tramos[p.id] ?? [] })));
}));

// ---------- Ver demanda sugerida por zona («extend» de Crear pedido) --------
comercianteRouter.get("/demanda/sugerida", soloComerciante, h(async (req, res) => {
  const zona = (req.query.zona_id as string) ?? req.user!.zona_id;
  const sql = `
    SELECT pd.producto_id, pr.nombre AS producto, pr.unidad_medida, m.razon_social AS mayorista,
           pd.periodo, pd.cantidad_estimada, pd.confianza
    FROM prediccion_demanda pd JOIN producto pr ON pr.id = pd.producto_id
    JOIN mayorista m ON m.usuario_id = pr.mayorista_id
    WHERE pd.zona_id = $1 AND pd.periodo >= date_trunc('week', now())::date
    ORDER BY pd.periodo, pd.cantidad_estimada DESC LIMIT 10`;
  let filas = await query(sql, [zona]);
  if (!filas.length) {
    // Sin predicciones vigentes: se piden al servicio de ML (las guarda en la BD).
    try {
      await ml.predecir(zona, 1);
      filas = await query(sql, [zona]);
    } catch (err) {
      console.warn("[demanda] ML no disponible:", (err as Error).message);
    }
  }
  res.json(filas);
}));

// ---------- Pedidos grupales ----------------------------------------------
comercianteRouter.get("/pedidos-grupales", h(async (req, res) => {
  const zona = (req.query.zona_id as string) ?? req.user!.zona_id;
  const estado = (req.query.estado as string) ?? "ABIERTO";
  const rows = await query(
    `${SQL_PEDIDOS} WHERE ($1::uuid IS NULL OR pg.zona_id = $1) AND pg.estado = $2::estado_pedido ${GROUP}
     ORDER BY pg.fecha_limite`,
    [zona ?? null, estado],
  );
  const mias = new Set((await query(
    "SELECT pedido_grupal_id FROM participacion WHERE comerciante_id = $1", [req.user!.id],
  )).map((r) => r.pedido_grupal_id));
  res.json((await enriquecer(rows)).map((p) => ({ ...p, mi_participacion: mias.has(p.id) ? { id: p.id } : null })));
}));

comercianteRouter.get("/pedidos-grupales/mios", soloComerciante, h(async (req, res) => {
  const rows = await query(
    `${SQL_PEDIDOS} WHERE pg.id IN (SELECT pedido_grupal_id FROM participacion WHERE comerciante_id = $1) ${GROUP}
     ORDER BY CASE pg.estado WHEN 'OFERTA_ACEPTADA' THEN 0 WHEN 'EN_REPARTO' THEN 1 WHEN 'ABIERTO' THEN 2 ELSE 3 END,
              pg.fecha_creacion DESC`,
    [req.user!.id],
  );
  const mias = await query(
    `SELECT pa.id, pa.pedido_grupal_id, pa.subtotal, pa.estado_pago,
            COALESCE(SUM(i.cantidad), 0)::int AS mis_unidades
     FROM participacion pa LEFT JOIN item_pedido i ON i.participacion_id = pa.id
     WHERE pa.comerciante_id = $1 GROUP BY pa.id`,
    [req.user!.id],
  );
  const porPedido = new Map(mias.map((m) => [m.pedido_grupal_id, m]));
  res.json((await enriquecer(rows)).map((p) => ({ ...p, mi_participacion: porPedido.get(p.id) ?? null })));
}));

comercianteRouter.get("/pedidos-grupales/:id", h(async (req, res) => {
  const p = await one(`${SQL_PEDIDOS} WHERE pg.id = $1 ${GROUP}`, [req.params.id]);
  if (!p) throw notFound("El pedido");
  const [detalle] = await enriquecer([p]);
  const participaciones = await query(
    `SELECT pa.id, pa.comerciante_id, c.nombre_comercial, pa.subtotal, pa.estado_pago, pa.fecha_union,
            json_agg(json_build_object('producto_id', i.producto_id, 'cantidad', i.cantidad,
                                       'precio_unitario', i.precio_unitario)) AS items
     FROM participacion pa JOIN comerciante c ON c.usuario_id = pa.comerciante_id
     JOIN item_pedido i ON i.participacion_id = pa.id
     WHERE pa.pedido_grupal_id = $1 GROUP BY pa.id, c.nombre_comercial ORDER BY pa.fecha_union`,
    [req.params.id],
  );
  const entrega = p.pedido_consolidado_id
    ? await one("SELECT * FROM entrega WHERE pedido_consolidado_id = $1", [p.pedido_consolidado_id])
    : null;
  const me = req.user!;
  res.json({
    ...detalle,
    // Otros comercios solo ven nombres y cantidades; los montos de cada uno son privados.
    participaciones: participaciones.map((pa) =>
      pa.comerciante_id === me.id || me.rol !== "COMERCIANTE" ? pa : { ...pa, subtotal: undefined, estado_pago: undefined },
    ),
    mi_participacion: participaciones.find((pa) => pa.comerciante_id === me.id) ?? null,
    entrega,
  });
}));

const itemsSchema = z.array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive() })).min(1);

async function guardarItems(db: any, participacionId: string, mayoristaId: string, items: z.infer<typeof itemsSchema>) {
  const productos = await query(
    "SELECT id, precio_unitario, mayorista_id, stock FROM producto WHERE id = ANY($1::uuid[]) AND activo",
    [items.map((i) => i.producto_id)],
    db,
  );
  for (const item of items) {
    const p = productos.find((x) => x.id === item.producto_id);
    if (!p) throw new HttpError(400, "Uno de los productos ya no está disponible.");
    if (p.mayorista_id !== mayoristaId) throw new HttpError(400, "Todos los productos deben ser del mismo mayorista del pedido.");
    await db.query(
      `INSERT INTO item_pedido (participacion_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)
       ON CONFLICT (participacion_id, producto_id) DO UPDATE SET cantidad = EXCLUDED.cantidad`,
      [participacionId, item.producto_id, item.cantidad, p.precio_unitario],
    );
  }
  await db.query(
    `UPDATE participacion SET subtotal = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM item_pedido
     WHERE participacion_id = $1) WHERE id = $1`,
    [participacionId],
  );
}

// Crear pedido grupal
comercianteRouter.post("/pedidos-grupales", soloComerciante, h(async (req, res) => {
  const body = z.object({
    items: itemsSchema,
    meta_unidades: z.number().int().positive(),
    fecha_limite: z.coerce.date().refine((d) => d.getTime() > Date.now() + 3600_000, "La fecha límite debe ser al menos en 1 hora."),
    nota: z.string().max(500).optional(),
  }).parse(req.body);
  const me = req.user!;
  if (!me.zona_id) throw new HttpError(400, "Tu negocio no tiene una zona asignada.");

  const creado = await tx(async (db) => {
    const prod = await one("SELECT mayorista_id FROM producto WHERE id = $1 AND activo", [body.items[0].producto_id], db);
    if (!prod) throw new HttpError(400, "El producto no está disponible.");
    const { n } = await one("SELECT count(*)::int + 101 AS n FROM pedido_grupal", [], db);
    const pg = await one(
      `INSERT INTO pedido_grupal (codigo, creador_id, mayorista_id, zona_id, meta_unidades, fecha_limite, nota)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [`JNT-${String(n).padStart(4, "0")}`, me.id, prod.mayorista_id, me.zona_id, body.meta_unidades, body.fecha_limite, body.nota ?? null],
      db,
    );
    const pa = await one(
      "INSERT INTO participacion (pedido_grupal_id, comerciante_id) VALUES ($1, $2) RETURNING id",
      [pg.id, me.id],
      db,
    );
    await guardarItems(db, pa.id, prod.mayorista_id, body.items);
    const vecinos = (await query("SELECT usuario_id FROM comerciante WHERE zona_id = $1 AND usuario_id <> $2", [me.zona_id, me.id], db))
      .map((r) => r.usuario_id);
    await notificar(vecinos, {
      titulo: "Nuevo pedido en tu zona",
      mensaje: `${me.nombre} abrió el pedido ${pg.codigo}. Únete antes de que cierre.`,
      tipo: "PEDIDO",
      referencia: pg.id,
    }, db);
    return pg;
  });
  res.status(201).json(creado);
}));

// Unirse a pedido grupal (o actualizar mis cantidades)
comercianteRouter.post("/pedidos-grupales/:id/unirse", soloComerciante, h(async (req, res) => {
  const { items } = z.object({ items: itemsSchema }).parse(req.body);
  const me = req.user!;
  const resultado = await tx(async (db) => {
    const pg = await one("SELECT * FROM pedido_grupal WHERE id = $1 FOR UPDATE", [req.params.id], db);
    if (!pg) throw notFound("El pedido");
    if (pg.estado !== "ABIERTO" || new Date(pg.fecha_limite) <= new Date()) throw conflict("Este pedido ya cerró.");
    if (pg.zona_id !== me.zona_id) throw forbidden("Solo pueden unirse comercios de la misma zona.");
    const pa = await one(
      `INSERT INTO participacion (pedido_grupal_id, comerciante_id) VALUES ($1, $2)
       ON CONFLICT (pedido_grupal_id, comerciante_id) DO UPDATE SET fecha_union = participacion.fecha_union
       RETURNING id, (xmax = 0) AS nueva`,
      [pg.id, me.id],
      db,
    );
    await guardarItems(db, pa.id, pg.mayorista_id, items);
    if (pa.nueva && pg.creador_id !== me.id) {
      await notificar([pg.creador_id], {
        titulo: "Alguien se unió a tu pedido",
        mensaje: `${me.nombre} se sumó al pedido ${pg.codigo}.`,
        tipo: "PEDIDO",
        referencia: pg.id,
      }, db);
    }
    return { participacion_id: pa.id, nueva: pa.nueva };
  });
  res.status(resultado.nueva ? 201 : 200).json(resultado);
}));

comercianteRouter.delete("/pedidos-grupales/:id/participacion", soloComerciante, h(async (req, res) => {
  const pg = await one("SELECT estado, creador_id FROM pedido_grupal WHERE id = $1", [req.params.id]);
  if (!pg) throw notFound("El pedido");
  if (pg.estado !== "ABIERTO") throw conflict("Ya no puedes salir: el pedido está cerrado.");
  if (pg.creador_id === req.user!.id) throw conflict("Quien crea el pedido no puede salir; puedes cerrarlo.");
  await query("DELETE FROM participacion WHERE pedido_grupal_id = $1 AND comerciante_id = $2", [req.params.id, req.user!.id]);
  res.status(204).end();
}));

comercianteRouter.post("/pedidos-grupales/:id/cerrar", soloComerciante, h(async (req, res) => {
  await cerrarPedido(req.params.id, req.user!.id);
  res.json({ ok: true });
}));

// Pagar su parte del pedido («include» de Unirse)
comercianteRouter.post("/participaciones/:id/pagar", soloComerciante, h(async (req, res) => {
  const { metodo, token } = z.object({
    metodo: z.enum(["TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"]),
    token: z.string().min(3), // token de Culqi Checkout (o "tok_demo" con la pasarela simulada)
  }).parse(req.body);
  const r = await pagarParticipacion(req.params.id, req.user!, metodo, token);
  res.status(r.pago.estado === "APROBADO" ? 201 : 402).json(r);
}));
