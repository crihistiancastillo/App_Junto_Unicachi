import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { config } from "./config.js";

let app: admin.app.App | null = null;

/** Devuelve la app de Firebase Admin, o null si no hay credenciales (modo demo). */
export function firebase(): admin.app.App | null {
  if (app) return app;
  try {
    if (config.firebaseServiceAccount) {
      const cred = JSON.parse(readFileSync(config.firebaseServiceAccount, "utf8"));
      app = admin.initializeApp({ credential: admin.credential.cert(cred) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
  } catch (err) {
    console.warn("[firebase] No se pudo inicializar:", (err as Error).message);
  }
  return app;
}
