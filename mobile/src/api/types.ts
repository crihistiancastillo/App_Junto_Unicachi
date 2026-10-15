export type Rol = "COMERCIANTE" | "MAYORISTA" | "ADMINISTRADOR";
export type EstadoPedido =
  | "ABIERTO" | "CERRADO" | "CONSOLIDADO" | "OFERTA_ACEPTADA"
  | "PAGADO" | "EN_REPARTO" | "ENTREGADO" | "CANCELADO";

export type Usuario = { id: string; nombre: string; email: string; rol: Rol; zona_id: string | null };

export type Tramo = { cantidad_minima: number; cantidad_maxima: number | null; porcentaje: number };

export type Producto = {
  id: string; sku: string; nombre: string; categoria: string; unidad_medida: string;
  precio_unitario: number; stock: number; imagen_url: string | null; activo: boolean;
  mayorista?: string; mayorista_id: string; tramos: Tramo[]; comprometidas?: number;
};

export type PedidoGrupal = {
  id: string; codigo: string; estado: EstadoPedido; etiqueta_estado: string;
  meta_unidades: number; unidades: number; progreso: number; participantes: number; nombres: string[];
  fecha_limite: string; fecha_creacion: string; zona: string; zona_id: string;
  mayorista: string; mayorista_id: string; creador_id: string;
  producto_id: string; producto: string; unidad_medida: string; imagen_url: string | null;
  precio_lista: number; precio_meta: number | null; descuento_maximo: number;
  siguiente_tramo: { faltan: number; porcentaje: number } | null; tramos: Tramo[];
  mi_participacion?: { id: string; subtotal: number; estado_pago: string; mis_unidades?: number; items?: any[] } | null;
};

export type Notificacion = {
  id: string; titulo: string; mensaje: string; tipo: string; referencia: string | null; leida: boolean; fecha_envio: string;
};
