import { config } from "../config.js";

export type EstadoPago = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "REEMBOLSADO";
export type ResultadoPago = { aprobado: boolean; idTransaccion: string | null; mensaje: string };
export type Cargo = { montoSoles: number; token: string; email: string; descripcion: string };

/** «interface» IPasarelaPago del diagrama de clases. */
export interface IPasarelaPago {
  readonly nombre: string;
  crearCargo(cargo: Cargo): Promise<ResultadoPago>;
  consultarEstado(idTx: string): Promise<EstadoPago>;
  reembolsar(idTx: string, montoSoles: number): Promise<boolean>;
}

/**
 * Pasarela simulada para desarrollo y demo.
 * El token "tok_rechazo" fuerza un pago rechazado para probar ese flujo.
 */
export class FakeGateway implements IPasarelaPago {
  readonly nombre = "fake";
  private estados = new Map<string, EstadoPago>();

  async crearCargo(cargo: Cargo): Promise<ResultadoPago> {
    if (cargo.token === "tok_rechazo") {
      return { aprobado: false, idTransaccion: null, mensaje: "Tarjeta rechazada por el banco emisor." };
    }
    const id = `fake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.estados.set(id, "APROBADO");
    return { aprobado: true, idTransaccion: id, mensaje: "Pago aprobado (simulado)." };
  }
  async consultarEstado(idTx: string) {
    return this.estados.get(idTx) ?? "PENDIENTE";
  }
  async reembolsar(idTx: string) {
    this.estados.set(idTx, "REEMBOLSADO");
    return true;
  }
}

/** Adaptador de Culqi (API v2). La app móvil tokeniza la tarjeta o Yape con Culqi Checkout. */
export class CulqiAdapter implements IPasarelaPago {
  readonly nombre = "culqi";
  private base = "https://api.culqi.com/v2";
  constructor(private apiKey: string) {
    if (!apiKey) throw new Error("Falta CULQI_SECRET_KEY.");
  }

  private async call(path: string, init: RequestInit = {}) {
    const res = await fetch(this.base + path, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", ...init.headers },
    });
    const body: any = await res.json().catch(() => ({}));
    return { ok: res.ok, body };
  }

  async crearCargo(c: Cargo): Promise<ResultadoPago> {
    const { ok, body } = await this.call("/charges", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(c.montoSoles * 100), // Culqi trabaja en céntimos
        currency_code: "PEN",
        email: c.email,
        source_id: c.token,
        description: c.descripcion.slice(0, 80),
      }),
    });
    return ok
      ? { aprobado: true, idTransaccion: body.id, mensaje: body.outcome?.user_message ?? "Pago aprobado." }
      : { aprobado: false, idTransaccion: null, mensaje: body.user_message ?? "No se pudo procesar el pago." };
  }

  async consultarEstado(idTx: string): Promise<EstadoPago> {
    const { ok, body } = await this.call(`/charges/${idTx}`);
    if (!ok) return "PENDIENTE";
    if (body.total_refunded > 0) return "REEMBOLSADO";
    return body.capture ? "APROBADO" : "PENDIENTE";
  }

  async reembolsar(idTx: string, montoSoles: number) {
    const { ok } = await this.call("/refunds", {
      method: "POST",
      body: JSON.stringify({ charge_id: idTx, amount: Math.round(montoSoles * 100), reason: "solicitud_comprador" }),
    });
    return ok;
  }
}

let instancia: IPasarelaPago | null = null;
export function pasarela(): IPasarelaPago {
  instancia ??= config.paymentGateway === "culqi" ? new CulqiAdapter(config.culqiSecretKey) : new FakeGateway();
  return instancia;
}
