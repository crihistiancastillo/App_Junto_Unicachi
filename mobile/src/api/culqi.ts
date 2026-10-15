/**
 * Tokenización con Culqi desde la app (llave pública). La tarjeta nunca llega
 * a nuestra API: solo enviamos el token, y la API crea el cargo con la llave secreta.
 * Sin EXPO_PUBLIC_CULQI_PUBLIC_KEY se devuelve un token de prueba para la pasarela simulada.
 */
const PUBLIC_KEY = process.env.EXPO_PUBLIC_CULQI_PUBLIC_KEY;

async function crearToken(path: string, body: object) {
  const res = await fetch(`https://secure.culqi.com/v2/tokens${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PUBLIC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.user_message ?? "No se pudo validar el medio de pago.");
  return data.id as string;
}

export const culqiActivo = !!PUBLIC_KEY;

export function tokenTarjeta(card: { numero: string; cvv: string; mes: string; anio: string; email: string }) {
  if (!PUBLIC_KEY) return Promise.resolve(card.numero.endsWith("0002") ? "tok_rechazo" : "tok_demo");
  return crearToken("", {
    card_number: card.numero.replace(/\s/g, ""),
    cvv: card.cvv,
    expiration_month: card.mes,
    expiration_year: card.anio.length === 2 ? `20${card.anio}` : card.anio,
    email: card.email,
  });
}

export function tokenYape(datos: { celular: string; otp: string; montoSoles: number }) {
  if (!PUBLIC_KEY) return Promise.resolve("tok_demo");
  return crearToken("/yape", {
    number_phone: datos.celular,
    otp: datos.otp,
    amount: Math.round(datos.montoSoles * 100),
  });
}
