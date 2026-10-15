import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} no existe.`);
export const forbidden = (msg = "No tienes permiso para esta acción.") => new HttpError(403, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Envuelve handlers async para que los errores lleguen al middleware de errores. */
export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos.", detalles: err.flatten().fieldErrors });
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Error interno. Intenta de nuevo." : err.message });
}
