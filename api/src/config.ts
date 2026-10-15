import "dotenv/config";

const bool = (v: string | undefined, d = false) => (v == null ? d : ["1", "true", "yes"].includes(v.toLowerCase()));

export const config = {
  port: Number(process.env.PORT ?? 3000),
  /** Si no se define, la API usa PostgreSQL embebido (PGlite) y no necesita Docker. */
  databaseUrl: process.env.DATABASE_URL || null,
  embeddedDir: process.env.EMBEDDED_DB_DIR ?? ".junto-db",
  sqlDir: process.env.SQL_DIR ?? "../database",
  /** Modo demo: acepta tokens "demo:<usuarioId>" sin Firebase. Nunca activar en producción. */
  demoMode: bool(process.env.DEMO_MODE, true),
  mlUrl: process.env.ML_URL ?? "http://localhost:8000",
  mlInternalKey: process.env.ML_INTERNAL_KEY ?? "dev-internal-key",
  paymentGateway: (process.env.PAYMENT_GATEWAY ?? "fake") as "fake" | "culqi",
  culqiSecretKey: process.env.CULQI_SECRET_KEY ?? "",
  /** Ruta al JSON de cuenta de servicio de Firebase (o GOOGLE_APPLICATION_CREDENTIALS). */
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
  jobIntervalMs: Number(process.env.JOB_INTERVAL_MS ?? 60_000),
};

if (config.demoMode && process.env.NODE_ENV === "production") {
  throw new Error("DEMO_MODE no puede estar activo en producción.");
}
