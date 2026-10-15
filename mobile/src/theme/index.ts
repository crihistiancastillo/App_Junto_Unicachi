/** Tokens visuales tomados del prototipo de Figma Make (src/index.css). */
export const colors = {
  brand: "#136a50",
  brandDark: "#173b31",
  brandSoft: "#e6f0e9",
  brandTint: "#eaf3ed",
  ink: "#1c2924",
  muted: "#6e7a74",
  line: "#dfe6e1",
  canvas: "#f7f9f6",
  white: "#ffffff",
  amber: "#a16a24",
  amberSoft: "#fff2dc",
  amberAccent: "#f2be5c",
  danger: "#b3402e",
  dangerSoft: "#fbe9e5",
  track: "#e9ede8",
};

export const fonts = {
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
  display: "Manrope_700Bold",
  displayHeavy: "Manrope_800ExtraBold",
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 28 };

export const shadow = {
  shadowColor: "#1c3127",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

export const soles = (n: number | null | undefined) =>
  n == null ? "—" : `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function tiempoRestante(fecha: string) {
  const ms = new Date(fecha).getTime() - Date.now();
  if (ms <= 0) return "Cerrado";
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return `Cierra en ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 24) return `Cierra en ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "Cierra mañana" : `Quedan ${d} días`;
}
