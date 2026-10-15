import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { one } from "../db.js";
import { firebase } from "../firebase.js";
import { HttpError, forbidden } from "./errors.js";

export type Rol = "COMERCIANTE" | "MAYORISTA" | "ADMINISTRADOR";
export type UsuarioSesion = { id: string; nombre: string; email: string; rol: Rol; zona_id: string | null };

declare global {
  namespace Express {
    interface Request {
      user?: UsuarioSesion;
      firebaseUid?: string;
    }
  }
}

const SQL_USUARIO = `
  SELECT u.id, u.nombre, u.email, u.rol, u.estado, c.zona_id
  FROM usuario u LEFT JOIN comerciante c ON c.usuario_id = u.id
  WHERE `;

async function resolverToken(token: string): Promise<{ user: any; firebaseUid?: string }> {
  if (config.demoMode && token.startsWith("demo:")) {
    return { user: await one(SQL_USUARIO + "u.id = $1", [token.slice(5)]) };
  }
  const fb = firebase();
  if (!fb) throw new HttpError(401, "Autenticación no configurada.");
  const decoded = await fb.auth().verifyIdToken(token).catch(() => {
    throw new HttpError(401, "Sesión expirada. Vuelve a iniciar sesión.");
  });
  return { user: await one(SQL_USUARIO + "u.firebase_uid = $1", [decoded.uid]), firebaseUid: decoded.uid };
}

/** Verifica el token (Firebase ID token o demo) y carga el usuario. */
export function autenticar(opts: { permitirSinRegistro?: boolean } = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
      const { user, firebaseUid } = await resolverToken(token);
      req.firebaseUid = firebaseUid;
      if (!user) {
        if (opts.permitirSinRegistro && firebaseUid) return next();
        throw new HttpError(401, "Tu cuenta no está registrada en Junto.");
      }
      if (user.estado === "SUSPENDIDA") throw forbidden("Tu cuenta está suspendida. Contacta a soporte.");
      req.user = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, zona_id: user.zona_id };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requiereRol =
  (...roles: Rol[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.rol) ? next() : next(forbidden());
