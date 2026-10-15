import { Router } from "express";
import { z } from "zod";
import { one, query, tx } from "../db.js";
import { requiereRol } from "../middleware/auth.js";
import { forbidden, h, notFound } from "../middleware/errors.js";
import { actualizarEntrega, consolidarDemanda, programarEntrega, responderOferta } from "../services/flows.js";

export const mayoristaRouter = Router();
mayoristaRouter.use("/mayorista", requiereRol("MAYORISTA"));

// ---------- Panel ("Resumen" del prototipo) --------------------------------
mayoristaRouter.get("/mayorista/resumen", h(async (req, res) => {
  const id = req.user!.id;
  res.json(await one(
    `SELECT
       (SELECT COALESCE(SUM(monto_neto), 0) FROM pedido_consolidado
         WHERE mayorista_id = $1 AND estado = 'ACEPTADO' AND fecha_consolidacion >= date_trunc('month', now())) AS ventas_mes,
       (SELECT count(*) FROM pedido_grupal WHERE mayorista_id = $1 AND estado = 'ABIERTO')::int AS pedidos_abiertos,
       (SELECT count(*) FROM oferta WHERE mayorista_id = $1 AND estado = 'PENDIENTE')::int AS ofertas_por_responder,
       (SELECT count(DISTINCT pa.comerciante_id) FROM participacion pa
          JOIN pedido_grupal pg ON pg.id = pa.pedido_grupal_id WHERE pg.mayorista_id = $1)::int AS comerciantes,
       (SELECT round(100.0 * count(*) FILTER (WHERE e.fecha_entrega::date <= e.fecha_programada)
                     / NULLIF(count(*) FILTER (WHERE e.estado = 'ENTREGADA'), 0))
          FROM entrega e JOIN pedido_consolidado pc ON pc.id = e.pedido_consolidado_id
         WHERE pc.mayorista_id = $1) AS entregas_a_tiempo`,
    [id],
  ));
}));

// ---------- Publicar productos y precios -----------------------------------
const productoSchema = z.object({
  sku: z.string().min(2).max(40),
  nombre: z.string().min(2).max(120),
  categoria: z.string().min(2),
  unidad_medida: z.string().min(1),
  precio_unitario: z.number().positive(),
  stock: z.number().int().min(0),
  imagen_url: z.string().url().optional().nullable(),
  activo: z.boolean().optional(),
});

mayoristaRouter.get("/mayorista/productos", h(async (req, res) => {
  res.json(await query(
    `SELECT p.*, COALESCE(json_agg(d ORDER BY d.cantidad_minima) FILTER (WHERE d.id IS NOT NULL), '[]') AS tramos,
       (SELECT COALESCE(SUM(i.cantidad), 0) FROM item_pedido i JOIN participacion pa ON pa.id = i.participacion_id
          JOIN pedido_grupal pg ON pg.id = pa.pedido_grupal_id
         WHERE i.producto_id = p.id AND pg.estado = 'ABIERTO')::int AS comprometidas
     FROM producto p LEFT JOIN descuento_volumen d ON d.producto_id = p.id
     WHERE p.mayorista_id = $1 GROUP BY p.id ORDER BY p.activo DESC, p.nombre`,
    [req.user!.id],
  ));
}));

mayoristaRouter.post("/mayorista/productos", h(async (req, res) => {
  const b = productoSchema.parse(req.body);
  res.status(201).json(await one(
    `INSERT INTO producto (mayorista_id, sku, nombre, categoria, unidad_medida, precio_unitario, stock, imagen_url, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, true)) RETURNING *`,
    [req.user!.id, b.sku, b.nombre, b.categoria, b.unidad_medida, b.precio_unitario, b.stock, b.imagen_url ?? null, b.activo ?? null],
  ));
}));

mayoristaRouter.patch("/mayorista/productos/:id", h(async (req, res) => {
  const b = productoSchema.partial().parse(req.body);
  const actual = await one("SELECT * FROM producto WHERE id = $1", [req.params.id]);
  if (!actual) throw notFound("El producto");
  if (actual.mayorista_id !== req.user!.id) throw forbidden();
  const m = { ...actual, ...b };
  res.json(await one(
    `UPDATE producto SET sku=$2, nombre=$3, categoria=$4, unidad_medida=$5, precio_unitario=$6, stock=$7, imagen_url=$8, activo=$9
     WHERE id = $1 RETURNING *`,
    [req.params.id, m.sku, m.nombre, m.categoria, m.unidad_medida, m.precio_unitario, m.stock, m.imagen_url, m.activo],
  ));
}));

// ---------- Definir descuentos por volumen ---------------------------------
mayoristaRouter.put("/mayorista/productos/:id/descuentos", h(async (req, res) => {
  const tramos = z.array(z.object({
    cantidad_minima: z.number().int().positive(),
    cantidad_maxima: z.number().int().positive().nullable(),
    porcentaje: z.number().gt(0).lt(100),
    vigente_hasta: z.string().date().optional().nullable(),
  })).max(6).parse(req.body)
    .sort((a, b) => a.cantidad_minima - b.cantidad_minima);

  // Los tramos no deben solaparse y el descuento debe crecer con el volumen.
  for (let i = 1; i < tramos.length; i++) {
    const prev = tramos[i - 1];
    if (prev.cantidad_maxima == null || prev.cantidad_maxima >= tramos[i].cantidad_minima) {
      return res.status(400).json({ error: "Los tramos se superponen. Revisa las cantidades mínimas y máximas." });
    }
    if (tramos[i].porcentaje <= prev.porcentaje) {
      return res.status(400).json({ error: "Cada tramo debe dar más descuento que el anterior." });
    }
  }

  const resultado = await tx(async (db) => {
    const p = await one("SELECT mayorista_id FROM producto WHERE id = $1", [req.params.id], db);
    if (!p) throw notFound("El producto");
    if (p.mayorista_id !== req.user!.id) throw forbidden();
    await db.query("DELETE FROM descuento_volumen WHERE producto_id = $1", [req.params.id]);
    for (const t of tramos) {
      await db.query(
        `INSERT INTO descuento_volumen (producto_id, cantidad_minima, cantidad_maxima, porcentaje, vigente_hasta)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, t.cantidad_minima, t.cantidad_maxima, t.porcentaje, t.vigente_hasta ?? null],
      );
    }
    return query("SELECT * FROM descuento_volumen WHERE producto_id = $1 ORDER BY cantidad_minima", [req.params.id], db);
  });
  res.json(resultado);
}));

// ---------- Revisar pedido consolidado («include» Consolidar demanda) -------
mayoristaRouter.get("/mayorista/consolidados", h(async (req, res) => {
  res.json(await query(
    `SELECT pc.*, o.id AS oferta_id, o.estado AS estado_oferta, o.motivo_rechazo,
            COALESCE(string_agg(DISTINCT z.nombre, ', '), '') AS zonas,
            count(DISTINCT pg.id)::int AS pedidos, e.id AS entrega_id, e.estado AS estado_entrega, e.fecha_programada
     FROM pedido_consolidado pc
     LEFT JOIN oferta o ON o.pedido_consolidado_id = pc.id
     LEFT JOIN pedido_grupal pg ON pg.pedido_consolidado_id = pc.id
     LEFT JOIN zona z ON z.id = pg.zona_id
     LEFT JOIN entrega e ON e.pedido_consolidado_id = pc.id
     WHERE pc.mayorista_id = $1
     GROUP BY pc.id, o.id, e.id
     ORDER BY (o.estado = 'PENDIENTE') DESC, pc.fecha_consolidacion DESC`,
    [req.user!.id],
  ));
}));

mayoristaRouter.get("/mayorista/consolidados/:id", h(async (req, res) => {
  const pc = await one("SELECT * FROM pedido_consolidado WHERE id = $1", [req.params.id]);
  if (!pc) throw notFound("El pedido consolidado");
  if (pc.mayorista_id !== req.user!.id) throw forbidden();
  const productos = await query(
    `SELECT pr.id, pr.nombre, pr.unidad_medida, pr.precio_unitario AS precio_lista, SUM(i.cantidad)::int AS cantidad,
            json_agg(json_build_object('zona', z.nombre, 'comercio', c.nombre_comercial, 'cantidad', i.cantidad)) AS desglose
     FROM pedido_grupal pg JOIN zona z ON z.id = pg.zona_id
     JOIN participacion pa ON pa.pedido_grupal_id = pg.id
     JOIN comerciante c ON c.usuario_id = pa.comerciante_id
     JOIN item_pedido i ON i.participacion_id = pa.id
     JOIN producto pr ON pr.id = i.producto_id
     WHERE pg.pedido_consolidado_id = $1 GROUP BY pr.id`,
    [req.params.id],
  );
  const oferta = await one("SELECT * FROM oferta WHERE pedido_consolidado_id = $1 ORDER BY fecha_creacion DESC", [req.params.id]);
  const entrega = await one("SELECT * FROM entrega WHERE pedido_consolidado_id = $1", [req.params.id]);
  const pagos = await one(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE pa.estado_pago = 'APROBADO')::int AS pagados
     FROM participacion pa JOIN pedido_grupal pg ON pg.id = pa.pedido_grupal_id WHERE pg.pedido_consolidado_id = $1`,
    [req.params.id],
  );
  res.json({ ...pc, productos, oferta, entrega, pagos });
}));

/** Permite al mayorista disparar la consolidación sin esperar al job del sistema. */
mayoristaRouter.post("/mayorista/consolidar", h(async (req, res) => {
  res.json(await consolidarDemanda(req.user!.id));
}));

// ---------- Aceptar o rechazar oferta --------------------------------------
mayoristaRouter.post("/mayorista/ofertas/:id/aceptar", h(async (req, res) => {
  res.json(await responderOferta(req.params.id, req.user!.id, true));
}));

mayoristaRouter.post("/mayorista/ofertas/:id/rechazar", h(async (req, res) => {
  const { motivo } = z.object({ motivo: z.string().min(3).max(300) }).parse(req.body);
  res.json(await responderOferta(req.params.id, req.user!.id, false, motivo));
}));

// ---------- Gestionar entregas ---------------------------------------------
mayoristaRouter.post("/mayorista/consolidados/:id/entrega", h(async (req, res) => {
  const b = z.object({ fecha_programada: z.string().date(), direccion: z.string().min(5) }).parse(req.body);
  res.status(201).json(await programarEntrega(req.params.id, req.user!.id, b.fecha_programada, b.direccion));
}));

mayoristaRouter.patch("/mayorista/entregas/:id", h(async (req, res) => {
  const b = z.object({
    estado: z.enum(["EN_CAMINO", "ENTREGADA", "FALLIDA"]),
    evidencia_url: z.string().url().optional(),
  }).parse(req.body);
  res.json(await actualizarEntrega(req.params.id, req.user!.id, b.estado, b.evidencia_url));
}));
