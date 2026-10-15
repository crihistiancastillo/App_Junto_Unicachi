/** Ciclo de vida de PedidoGrupal (enum EstadoPedido del diagrama de clases). */

export const ESTADOS = [
  "ABIERTO",
  "CERRADO",
  "CONSOLIDADO",
  "OFERTA_ACEPTADA",
  "PAGADO",
  "EN_REPARTO",
  "ENTREGADO",
  "CANCELADO",
] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  ABIERTO: ["CERRADO", "CANCELADO"],
  CERRADO: ["CONSOLIDADO", "CANCELADO"],
  CONSOLIDADO: ["OFERTA_ACEPTADA", "CANCELADO"], // CANCELADO si el mayorista rechaza
  OFERTA_ACEPTADA: ["PAGADO", "CANCELADO"],
  PAGADO: ["EN_REPARTO"],
  EN_REPARTO: ["ENTREGADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export function assertTransicion(desde: EstadoPedido, hacia: EstadoPedido): void {
  if (!puedeTransicionar(desde, hacia)) {
    throw Object.assign(new Error(`El pedido no puede pasar de ${desde} a ${hacia}.`), { status: 409 });
  }
}

/** Texto que ve el comerciante en "Mis pedidos" (mismo vocabulario que el prototipo). */
export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  ABIERTO: "Completando cuota",
  CERRADO: "Cuota cerrada",
  CONSOLIDADO: "Negociando con el mayorista",
  OFERTA_ACEPTADA: "Paga tu parte",
  PAGADO: "Confirmado",
  EN_REPARTO: "En reparto",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

/** Progreso visual del pedido (barra de la tarjeta). */
export function progreso(estado: EstadoPedido, unidades: number, meta: number): number {
  if (estado === "ABIERTO") return Math.min(100, Math.round((unidades / Math.max(meta, 1)) * 100));
  return estado === "CANCELADO" ? 0 : 100;
}
