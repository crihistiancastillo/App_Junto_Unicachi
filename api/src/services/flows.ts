/**
 * Flujos de negocio que cruzan varias clases del diagrama:
 * cierre de pedidos, consolidación por zona (sistema), oferta, pago y entrega.
 */
import { one, pool, query, tx, type Client } from "../db.js";
import { consolidar, type Tramo } from "../domain/pricing.js";
import { assertTransicion, type EstadoPedido } from "../domain/orderState.js";
import { conflict, forbidden, HttpError, notFound } from "../middleware/errors.js";
import { pasarela } from "../payments/gateway.js";
import { ml, type GrupoML, type PedidoParaAgrupar } from "./ml.js";
import { notificar } from "./notifications.js";

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function participantes(pedidoIds: string[], db: Client | typeof pool = pool) {
  return (await query<{ comerciante_id: string }>(
    "SELECT DISTINCT comerciante_id FROM participacion WHERE pedido_grupal_id = ANY($1::uuid[])",
    [pedidoIds],
    db,
  )).map((r) => r.comerciante_id);
}

async function cambiarEstado(db: Client, pedidoIds: string[], hacia: EstadoPedido) {
  const actuales = await query<{ id: string; estado: EstadoPedido }>(
    "SELECT id, estado FROM pedido_grupal WHERE id = ANY($1::uuid[]) FOR UPDATE",
    [pedidoIds],
    db,
  );
  actuales.forEach((p) => assertTransicion(p.estado, hacia));
  await db.query(
    `UPDATE pedido_grupal SET estado = $2::estado_pedido,
       fecha_cierre = CASE WHEN $2::estado_pedido = 'CERRADO' AND fecha_cierre IS NULL THEN now() ELSE fecha_cierre END
     WHERE id = ANY($1::uuid[])`,
    [pedidoIds, hacia],
  );
}

// ---------------------------------------------------------------------------
// 1. Cierre automático de pedidos vencidos (job del sistema)
// ---------------------------------------------------------------------------
export async function cerrarPedidosVencidos(): Promise<number> {
  const vencidos = await query<{ id: string; codigo: string }>(
    "SELECT id, codigo FROM pedido_grupal WHERE estado = 'ABIERTO' AND fecha_limite <= now()",
  );
  for (const p of vencidos) await cerrarPedido(p.id);
  return vencidos.length;
}

export async function cerrarPedido(pedidoId: string, solicitanteId?: string) {
  await tx(async (db) => {
    const p = await one("SELECT * FROM pedido_grupal WHERE id = $1 FOR UPDATE", [pedidoId], db);
    if (!p) throw notFound("El pedido");
    if (solicitanteId && p.creador_id !== solicitanteId) throw forbidden("Solo quien creó el pedido puede cerrarlo.");
    const { unidades } = await one(
      `SELECT COALESCE(SUM(i.cantidad), 0)::int AS unidades
       FROM item_pedido i JOIN participacion pa ON pa.id = i.participacion_id WHERE pa.pedido_grupal_id = $1`,
      [pedidoId],
      db,
    );
    // Sin participantes no hay nada que negociar: se cancela.
    const destino: EstadoPedido = unidades > 0 ? "CERRADO" : "CANCELADO";
    await cambiarEstado(db, [pedidoId], destino);
    await notificar(
      await participantes([pedidoId], db),
      destino === "CERRADO"
        ? { titulo: `Pedido ${p.codigo} cerrado`, mensaje: `Se juntaron ${unidades} unidades. Ahora lo negociamos con el mayorista.`, tipo: "PEDIDO", referencia: pedidoId }
        : { titulo: `Pedido ${p.codigo} cancelado`, mensaje: "Venció sin participantes.", tipo: "PEDIDO", referencia: pedidoId },
      db,
    );
  });
}

// ---------------------------------------------------------------------------
// 2. Consolidar demanda por zona (caso de uso del sistema)
// ---------------------------------------------------------------------------
async function pedidosCerradosSinConsolidar(mayoristaId?: string): Promise<PedidoParaAgrupar[]> {
  return query(
    `SELECT pg.id, pg.mayorista_id, pg.zona_id, z.latitud, z.longitud, pg.fecha_cierre,
            COALESCE(SUM(i.cantidad), 0)::int AS unidades,
            COALESCE(array_agg(DISTINCT i.producto_id) FILTER (WHERE i.producto_id IS NOT NULL), '{}') AS productos
     FROM pedido_grupal pg
     JOIN zona z ON z.id = pg.zona_id
     LEFT JOIN participacion pa ON pa.pedido_grupal_id = pg.id
     LEFT JOIN item_pedido i ON i.participacion_id = pa.id
     WHERE pg.estado = 'CERRADO' AND pg.pedido_consolidado_id IS NULL
       AND ($1::uuid IS NULL OR pg.mayorista_id = $1)
     GROUP BY pg.id, z.latitud, z.longitud`,
    [mayoristaId ?? null],
  );
}

/** Si el servicio de ML no responde, se agrupa por mayorista + zona (regla simple). */
function agruparSinML(pedidos: PedidoParaAgrupar[]): GrupoML[] {
  const grupos = new Map<string, PedidoParaAgrupar[]>();
  for (const p of pedidos) {
    const k = `${p.mayorista_id}|${p.zona_id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  return [...grupos.values()].map((ps, i) => ({
    cluster_id: i,
    mayorista_id: ps[0].mayorista_id,
    pedido_ids: ps.map((p) => p.id),
    zonas: [ps[0].zona_id],
    total_unidades: ps.reduce((s, p) => s + p.unidades, 0),
  }));
}

export async function consolidarDemanda(mayoristaId?: string) {
  const pedidos = await pedidosCerradosSinConsolidar(mayoristaId);
  if (!pedidos.length) return [];

  let grupos: GrupoML[];
  try {
    grupos = (await ml.agrupar(pedidos)).grupos;
  } catch (err) {
    console.warn("[consolidar] ML no disponible, agrupando por zona:", (err as Error).message);
    grupos = agruparSinML(pedidos);
  }

  const creados: Awaited<ReturnType<typeof crearConsolidado>>[] = [];
  for (const g of grupos) creados.push(await crearConsolidado(g));
  return creados;
}

async function lineasYTramos(pedidoIds: string[], db: Client) {
  const lineas = await query<{ producto_id: string; cantidad: number; precio_lista: number }>(
    `SELECT i.producto_id, i.cantidad, pr.precio_unitario AS precio_lista
     FROM item_pedido i
     JOIN participacion pa ON pa.id = i.participacion_id
     JOIN producto pr ON pr.id = i.producto_id
     WHERE pa.pedido_grupal_id = ANY($1::uuid[])`,
    [pedidoIds],
    db,
  );
  const tramos = await query<Tramo & { producto_id: string }>(
    "SELECT * FROM descuento_volumen WHERE producto_id = ANY($1::uuid[])",
    [[...new Set(lineas.map((l) => l.producto_id))]],
    db,
  );
  const tramosPorProducto: Record<string, Tramo[]> = {};
  for (const t of tramos) (tramosPorProducto[t.producto_id] ??= []).push(t);
  return { lineas, tramosPorProducto };
}

async function crearConsolidado(g: GrupoML) {
  return tx(async (db) => {
    const { lineas, tramosPorProducto } = await lineasYTramos(g.pedido_ids, db);
    const r = consolidar(lineas, tramosPorProducto);
    const pc = await one(
      `INSERT INTO pedido_consolidado
         (mayorista_id, zona_id, total_unidades, monto_bruto, porcentaje_descuento, monto_neto, cluster_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [g.mayorista_id, g.zonas.length === 1 ? g.zonas[0] : null, r.total_unidades, r.monto_bruto,
       r.porcentaje_descuento, r.monto_neto, g.cluster_id],
      db,
    );
    await cambiarEstado(db, g.pedido_ids, "CONSOLIDADO");
    await db.query("UPDATE pedido_grupal SET pedido_consolidado_id = $1 WHERE id = ANY($2::uuid[])", [pc.id, g.pedido_ids]);
    await db.query(
      `INSERT INTO oferta (pedido_consolidado_id, mayorista_id, porcentaje_descuento, monto_final)
       VALUES ($1, $2, $3, $4)`,
      [pc.id, g.mayorista_id, r.porcentaje_descuento, r.monto_neto],
    );
    await notificar([g.mayorista_id], {
      titulo: "Nuevo pedido consolidado",
      mensaje: `${r.total_unidades} unidades de ${g.zonas.length} zona(s) por ${soles(r.monto_neto)} (${r.porcentaje_descuento} % dscto.). Revísalo y responde.`,
      tipo: "OFERTA",
      referencia: pc.id,
    }, db);
    return { ...pc, detalle: r.detalle };
  });
}

// ---------------------------------------------------------------------------
// 3. Aceptar o rechazar oferta (Mayorista)
// ---------------------------------------------------------------------------
export async function responderOferta(ofertaId: string, mayoristaId: string, acepta: boolean, motivo?: string) {
  return tx(async (db) => {
    const of = await one("SELECT * FROM oferta WHERE id = $1 FOR UPDATE", [ofertaId], db);
    if (!of) throw notFound("La oferta");
    if (of.mayorista_id !== mayoristaId) throw forbidden();
    if (of.estado !== "PENDIENTE") throw conflict("Esta oferta ya fue respondida.");
    if (!acepta && !motivo?.trim()) throw new HttpError(400, "Indica el motivo del rechazo.");

    const pedidoIds = (await query<{ id: string }>(
      "SELECT id FROM pedido_grupal WHERE pedido_consolidado_id = $1", [of.pedido_consolidado_id], db,
    )).map((r) => r.id);

    await db.query(
      "UPDATE oferta SET estado = $2, motivo_rechazo = $3, fecha_respuesta = now() WHERE id = $1",
      [ofertaId, acepta ? "ACEPTADA" : "RECHAZADA", acepta ? null : motivo],
    );
    await db.query("UPDATE pedido_consolidado SET estado = $2 WHERE id = $1",
      [of.pedido_consolidado_id, acepta ? "ACEPTADO" : "RECHAZADO"]);

    if (!acepta) {
      await cambiarEstado(db, pedidoIds, "CANCELADO");
      await notificar(await participantes(pedidoIds, db), {
        titulo: "El mayorista no aceptó el pedido",
        mensaje: `Motivo: ${motivo}. No se te cobró nada.`,
        tipo: "OFERTA",
        referencia: pedidoIds[0],
      }, db);
      return { estado: "RECHAZADA" };
    }

    // Aplica a cada ítem el precio final del tramo alcanzado por el volumen combinado.
    const { lineas, tramosPorProducto } = await lineasYTramos(pedidoIds, db);
    const r = consolidar(lineas, tramosPorProducto);
    for (const d of r.detalle) {
      await db.query(
        `UPDATE item_pedido i SET precio_unitario = $1
         FROM participacion pa
         WHERE pa.id = i.participacion_id AND i.producto_id = $2 AND pa.pedido_grupal_id = ANY($3::uuid[])`,
        [d.precio_final, d.producto_id, pedidoIds],
      );
    }
    await db.query(
      `UPDATE participacion pa SET subtotal = s.total
       FROM (SELECT participacion_id, SUM(cantidad * precio_unitario) AS total FROM item_pedido GROUP BY 1) s
       WHERE s.participacion_id = pa.id AND pa.pedido_grupal_id = ANY($1::uuid[])`,
      [pedidoIds],
    );
    await cambiarEstado(db, pedidoIds, "OFERTA_ACEPTADA");

    const montos = await query<{ comerciante_id: string; subtotal: number; pedido_grupal_id: string }>(
      "SELECT comerciante_id, subtotal, pedido_grupal_id FROM participacion WHERE pedido_grupal_id = ANY($1::uuid[])",
      [pedidoIds],
      db,
    );
    for (const m of montos) {
      await notificar([m.comerciante_id], {
        titulo: `¡Descuento conseguido: ${r.porcentaje_descuento} %!`,
        mensaje: `Paga tu parte (${soles(m.subtotal)}) para confirmar tu pedido.`,
        tipo: "PAGO",
        referencia: m.pedido_grupal_id,
      }, db);
    }
    return { estado: "ACEPTADA", porcentaje_descuento: r.porcentaje_descuento };
  });
}

// ---------------------------------------------------------------------------
// 4. Pagar su parte del pedido (Comerciante + Pasarela de pago)
// ---------------------------------------------------------------------------
export async function pagarParticipacion(participacionId: string, comerciante: { id: string; email: string },
                                         metodo: string, token: string) {
  const pa = await one(
    `SELECT pa.*, pg.estado AS estado_pedido, pg.codigo, pg.id AS pedido_id, pg.mayorista_id
     FROM participacion pa JOIN pedido_grupal pg ON pg.id = pa.pedido_grupal_id WHERE pa.id = $1`,
    [participacionId],
  );
  if (!pa) throw notFound("La participación");
  if (pa.comerciante_id !== comerciante.id) throw forbidden();
  if (pa.estado_pago === "APROBADO") throw conflict("Esta parte ya está pagada.");
  if (pa.estado_pedido !== "OFERTA_ACEPTADA") throw conflict("Podrás pagar cuando el mayorista acepte el pedido.");

  // El cobro ocurre fuera de la transacción: nunca mantener locks durante una llamada externa.
  const gw = pasarela();
  const resultado = await gw.crearCargo({
    montoSoles: pa.subtotal, token, email: comerciante.email, descripcion: `Junto ${pa.codigo}`,
  });

  return tx(async (db) => {
    const pago = await one(
      `INSERT INTO pago (participacion_id, monto, metodo, estado, pasarela, id_transaccion_externa)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [participacionId, pa.subtotal, metodo, resultado.aprobado ? "APROBADO" : "RECHAZADO", gw.nombre, resultado.idTransaccion],
      db,
    );
    if (!resultado.aprobado) return { pago, mensaje: resultado.mensaje };

    await db.query("UPDATE participacion SET estado_pago = 'APROBADO' WHERE id = $1", [participacionId]);
    const { pendientes } = await one(
      "SELECT count(*)::int AS pendientes FROM participacion WHERE pedido_grupal_id = $1 AND estado_pago <> 'APROBADO'",
      [pa.pedido_id],
      db,
    );
    if (pendientes === 0) {
      await cambiarEstado(db, [pa.pedido_id], "PAGADO");
      await notificar([pa.mayorista_id], {
        titulo: `Pedido ${pa.codigo} pagado`,
        mensaje: "Todos los comercios pagaron. Ya puedes programar la entrega.",
        tipo: "ENTREGA",
        referencia: pa.pedido_id,
      }, db);
    }
    return { pago, mensaje: resultado.mensaje };
  });
}

// ---------------------------------------------------------------------------
// 5. Gestionar entregas (Mayorista)
// ---------------------------------------------------------------------------
export async function programarEntrega(consolidadoId: string, mayoristaId: string, fecha: string, direccion: string) {
  return tx(async (db) => {
    const pc = await one("SELECT * FROM pedido_consolidado WHERE id = $1", [consolidadoId], db);
    if (!pc) throw notFound("El pedido consolidado");
    if (pc.mayorista_id !== mayoristaId) throw forbidden();
    if (pc.estado !== "ACEPTADO") throw conflict("Solo se programan entregas de pedidos aceptados.");
    const entrega = await one(
      `INSERT INTO entrega (pedido_consolidado_id, fecha_programada, direccion) VALUES ($1, $2, $3)
       ON CONFLICT (pedido_consolidado_id) DO UPDATE SET fecha_programada = EXCLUDED.fecha_programada,
         direccion = EXCLUDED.direccion RETURNING *`,
      [consolidadoId, fecha, direccion],
      db,
    );
    const pedidoIds = (await query("SELECT id FROM pedido_grupal WHERE pedido_consolidado_id = $1", [consolidadoId], db)).map((r) => r.id);
    await notificar(await participantes(pedidoIds, db), {
      titulo: "Entrega programada",
      mensaje: `Tu pedido llegará el ${new Date(fecha).toLocaleDateString("es-PE")} a ${direccion}.`,
      tipo: "ENTREGA",
      referencia: pedidoIds[0],
    }, db);
    return entrega;
  });
}

export async function actualizarEntrega(entregaId: string, mayoristaId: string, estado: string, evidenciaUrl?: string) {
  return tx(async (db) => {
    const e = await one(
      `SELECT e.*, pc.mayorista_id FROM entrega e JOIN pedido_consolidado pc ON pc.id = e.pedido_consolidado_id
       WHERE e.id = $1 FOR UPDATE OF e`,
      [entregaId],
      db,
    );
    if (!e) throw notFound("La entrega");
    if (e.mayorista_id !== mayoristaId) throw forbidden();
    const pedidos = await query<{ id: string; estado: EstadoPedido }>(
      "SELECT id, estado FROM pedido_grupal WHERE pedido_consolidado_id = $1", [e.pedido_consolidado_id], db,
    );
    const ids = pedidos.map((p) => p.id);

    if (estado === "EN_CAMINO") {
      const noPagados = pedidos.filter((p) => p.estado !== "PAGADO");
      if (noPagados.length) throw conflict("Hay pedidos con pagos pendientes; no se pueden despachar todavía.");
      await cambiarEstado(db, ids, "EN_REPARTO");
    }
    if (estado === "ENTREGADA") {
      await cambiarEstado(db, ids.filter((id) => pedidos.find((p) => p.id === id)!.estado === "PAGADO"), "EN_REPARTO");
      await cambiarEstado(db, ids, "ENTREGADO");
      // Retroalimenta al modelo de ML con la demanda real de la semana.
      await db.query(
        `INSERT INTO historial_demanda (zona_id, producto_id, semana, cantidad)
         SELECT pg.zona_id, i.producto_id, date_trunc('week', now())::date, SUM(i.cantidad)
         FROM pedido_grupal pg JOIN participacion pa ON pa.pedido_grupal_id = pg.id
         JOIN item_pedido i ON i.participacion_id = pa.id
         WHERE pg.id = ANY($1::uuid[]) GROUP BY 1, 2, 3
         ON CONFLICT (zona_id, producto_id, semana) DO UPDATE
           SET cantidad = historial_demanda.cantidad + EXCLUDED.cantidad`,
        [ids],
      );
    }
    const actualizada = await one(
      `UPDATE entrega SET estado = $2, evidencia_url = COALESCE($3, evidencia_url),
         fecha_entrega = CASE WHEN $2 = 'ENTREGADA' THEN now() ELSE fecha_entrega END
       WHERE id = $1 RETURNING *`,
      [entregaId, estado, evidenciaUrl ?? null],
      db,
    );
    await notificar(await participantes(ids, db), {
      titulo: estado === "ENTREGADA" ? "Pedido entregado" : estado === "EN_CAMINO" ? "Tu pedido está en camino" : "Problema con la entrega",
      mensaje: estado === "FALLIDA" ? "El mayorista reprogramará la entrega." : "Revisa el detalle en Mis pedidos.",
      tipo: "ENTREGA",
      referencia: ids[0],
    }, db);
    return actualizada;
  });
}
