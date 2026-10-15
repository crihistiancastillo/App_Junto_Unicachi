import { config } from "../config.js";

/** Cliente del microservicio de Python (scikit-learn). */
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(config.mlUrl + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": config.mlInternalKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ML ${path} respondió ${res.status}`);
  return res.json() as Promise<T>;
}

export type PedidoParaAgrupar = {
  id: string;
  mayorista_id: string;
  zona_id: string;
  latitud: number;
  longitud: number;
  fecha_cierre: string;
  unidades: number;
  productos: string[];
};
export type GrupoML = { cluster_id: number; mayorista_id: string; pedido_ids: string[]; zonas: string[]; total_unidades: number };

export const ml = {
  agrupar: (pedidos: PedidoParaAgrupar[]) => post<{ grupos: GrupoML[] }>("/pedidos/agrupar", { pedidos }),
  predecir: (zona_id?: string, horizonte_semanas = 1) =>
    post<{ predicciones: { zona_id: string; producto_id: string; periodo: string; cantidad_estimada: number; confianza: number }[] }>(
      "/demanda/predecir",
      { zona_id, horizonte_semanas, guardar: true },
    ),
  entrenar: () => post<{ mape_validacion: number; confianza: number }>("/demanda/entrenar", {}),
};
