import cors from "cors";
import express from "express";
import helmet from "helmet";
import { autenticar } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
import { adminRouter, comunRouter, publicRouter } from "./routes/comun.js";
import { comercianteRouter } from "./routes/comerciante.js";
import { mayoristaRouter } from "./routes/mayorista.js";

export function crearApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "200kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, servicio: "junto-api" }));
  app.use("/api", publicRouter);
  app.use("/api", autenticar(), comunRouter, comercianteRouter, mayoristaRouter, adminRouter);

  app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use(errorHandler);
  return app;
}
