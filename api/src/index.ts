import { config } from "./config.js";
import { crearApp } from "./app.js";
import { pool } from "./db.js";
import { cerrarPedidosVencidos, consolidarDemanda } from "./services/flows.js";

const app = crearApp();
const server = app.listen(config.port, () => {
  console.log(`Junto API escuchando en :${config.port} ${config.demoMode ? "(modo demo)" : ""}`);
});

/**
 * Job del sistema: cierra pedidos vencidos y consolida la demanda por zona.
 * En producción conviene moverlo a Cloud Scheduler / cron para no duplicarlo
 * cuando haya varias réplicas de la API.
 */
let corriendo = false;
const job = setInterval(async () => {
  if (corriendo) return;
  corriendo = true;
  try {
    const cerrados = await cerrarPedidosVencidos();
    const consolidados = await consolidarDemanda();
    if (cerrados || consolidados.length) console.log(`[job] cerrados=${cerrados} consolidados=${consolidados.length}`);
  } catch (err) {
    console.error("[job]", (err as Error).message);
  } finally {
    corriendo = false;
  }
}, config.jobIntervalMs);

const apagar = () => {
  clearInterval(job);
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
