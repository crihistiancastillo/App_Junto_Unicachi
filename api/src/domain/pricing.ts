/**
 * Reglas de precio por volumen (Producto.precioPara / DescuentoVolumen.aplica).
 * Funciones puras: no tocan la base de datos, así que se prueban sin infraestructura.
 */

export type Tramo = {
  cantidad_minima: number;
  cantidad_maxima: number | null;
  porcentaje: number;
  vigente_desde?: string | Date | null;
  vigente_hasta?: string | Date | null;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const toDay = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

/** DescuentoVolumen.aplica(cantidad): rango de cantidades y vigencia. */
export function tramoAplica(t: Tramo, cantidad: number, hoy: Date = new Date()): boolean {
  const dia = toDay(hoy);
  if (t.vigente_desde && toDay(t.vigente_desde) > dia) return false;
  if (t.vigente_hasta && toDay(t.vigente_hasta) < dia) return false;
  return cantidad >= t.cantidad_minima && (t.cantidad_maxima == null || cantidad <= t.cantidad_maxima);
}

/** Mayor porcentaje entre los tramos que aplican (0 si ninguno). */
export function descuentoPara(tramos: Tramo[], cantidad: number, hoy: Date = new Date()): number {
  return tramos.filter((t) => tramoAplica(t, cantidad, hoy)).reduce((max, t) => Math.max(max, Number(t.porcentaje)), 0);
}

/** Producto.precioPara(cantidad). */
export function precioPara(precioLista: number, tramos: Tramo[], cantidad: number, hoy?: Date): number {
  return round2(precioLista * (1 - descuentoPara(tramos, cantidad, hoy) / 100));
}

/** Próximo tramo por alcanzar: alimenta el mensaje "faltan N para X %". */
export function siguienteTramo(tramos: Tramo[], cantidad: number, hoy: Date = new Date()) {
  const actual = descuentoPara(tramos, cantidad, hoy);
  const candidatos = tramos
    .filter((t) => Number(t.porcentaje) > actual && t.cantidad_minima > cantidad)
    .sort((a, b) => a.cantidad_minima - b.cantidad_minima);
  const t = candidatos[0];
  return t ? { faltan: t.cantidad_minima - cantidad, porcentaje: Number(t.porcentaje) } : null;
}

export type LineaConsolidable = { producto_id: string; cantidad: number; precio_lista: number };

/**
 * Núcleo de PedidoConsolidado.aplicarDescuentos(): suma las cantidades de
 * todos los pedidos del grupo por producto y aplica el tramo que alcanza
 * el volumen COMBINADO (esa es la ventaja de comprar juntos).
 */
export function consolidar(lineas: LineaConsolidable[], tramosPorProducto: Record<string, Tramo[]>, hoy?: Date) {
  const porProducto = new Map<string, { cantidad: number; precio_lista: number }>();
  for (const l of lineas) {
    const acc = porProducto.get(l.producto_id) ?? { cantidad: 0, precio_lista: l.precio_lista };
    acc.cantidad += l.cantidad;
    porProducto.set(l.producto_id, acc);
  }

  const detalle = [...porProducto.entries()].map(([producto_id, { cantidad, precio_lista }]) => {
    const porcentaje = descuentoPara(tramosPorProducto[producto_id] ?? [], cantidad, hoy);
    const precio_final = round2(precio_lista * (1 - porcentaje / 100));
    return {
      producto_id,
      cantidad,
      precio_lista,
      porcentaje,
      precio_final,
      bruto: round2(cantidad * precio_lista),
      neto: round2(cantidad * precio_final),
    };
  });

  const bruto = round2(detalle.reduce((s, d) => s + d.bruto, 0));
  const neto = round2(detalle.reduce((s, d) => s + d.neto, 0));
  return {
    detalle,
    total_unidades: detalle.reduce((s, d) => s + d.cantidad, 0),
    monto_bruto: bruto,
    monto_neto: neto,
    porcentaje_descuento: bruto > 0 ? round2((1 - neto / bruto) * 100) : 0,
  };
}
