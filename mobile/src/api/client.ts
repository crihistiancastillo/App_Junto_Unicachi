import { useCallback, useEffect, useState } from "react";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000/api";
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== "false";

let tokenProvider: () => Promise<string | null> = async () => null;
/** AuthContext registra aquí cómo obtener el token vigente (demo o Firebase). */
export const setTokenProvider = (fn: () => Promise<string | null>) => {
  tokenProvider = fn;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const token = init.token ?? (await tokenProvider());
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Sin conexión con el servidor. Revisa tu internet.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Algo salió mal.");
  return data as T;
}

/** Carga datos de la API con estados de carga/error y recarga manual. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
