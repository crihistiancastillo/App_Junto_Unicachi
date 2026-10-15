import { fueraDeTx, query, type Db, pool } from "../db.js";
import { firebase } from "../firebase.js";

export type NuevaNotificacion = { titulo: string; mensaje: string; tipo: string; referencia?: string | null };

/**
 * ServicioNotificaciones: guarda la notificación (bandeja en la app) y envía
 * el push por Firebase Cloud Messaging a todos los dispositivos del usuario.
 * Sin credenciales de Firebase (modo demo) solo guarda y registra en consola.
 */
export async function notificar(usuarioIds: string[], n: NuevaNotificacion, db: Db = pool) {
  const ids = [...new Set(usuarioIds)];
  if (!ids.length) return;
  await query(
    `INSERT INTO notificacion (usuario_id, titulo, mensaje, tipo, referencia)
     SELECT unnest($1::uuid[]), $2::text, $3::text, $4::text, $5::uuid`,
    [ids, n.titulo, n.mensaje, n.tipo, n.referencia ?? null],
    db,
  );
  // El push se envía fuera de la transacción para no bloquearla.
  setImmediate(() => fueraDeTx(() => enviarPush(ids, n).catch((e) => console.warn("[fcm]", e.message))));
}

async function enviarPush(usuarioIds: string[], n: NuevaNotificacion) {
  const fb = firebase();
  const tokens = (await query<{ fcm_token: string }>(
    "SELECT fcm_token FROM dispositivo WHERE usuario_id = ANY($1::uuid[])",
    [usuarioIds],
  )).map((r) => r.fcm_token);
  if (!fb || !tokens.length) {
    console.log(`[push:demo] ${n.titulo} → ${usuarioIds.length} usuario(s)`);
    return;
  }
  const res = await fb.messaging().sendEachForMulticast({
    tokens,
    notification: { title: n.titulo, body: n.mensaje },
    data: { tipo: n.tipo, referencia: n.referencia ?? "" },
  });
  // Limpia tokens que FCM reporta como inválidos.
  const invalidos = res.responses
    .map((r, i) => (r.error?.code === "messaging/registration-token-not-registered" ? tokens[i] : null))
    .filter(Boolean);
  if (invalidos.length) await query("DELETE FROM dispositivo WHERE fcm_token = ANY($1)", [invalidos]);
}
