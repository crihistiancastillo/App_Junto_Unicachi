import type { ImageSourcePropType } from "react-native";

/**
 * Imágenes de producto.
 * - "local:<nombre>" apunta a un archivo dentro de mobile/assets/productos (se empaqueta con la app).
 * - Cualquier otra cadena se trata como URL pública (https://...).
 * Para agregar una foto: guárdala en mobile/assets/productos, agrega una línea en LOCALES
 * y pon 'local:<nombre>' en la columna imagen_url del producto (database/02_seed_demo.sql).
 */
const LOCALES: Record<string, ImageSourcePropType> = {
  "aceite-primor": require("../../assets/productos/aceite-primor.png"),
  "papa-canchan": require("../../assets/productos/papa-canchan.png"),
  "naranja-valencia": require("../../assets/productos/naranja-valencia.png"),
};

export type FuenteImagen = { source: ImageSourcePropType; resizeMode: "contain" | "cover" };

export function imagenProducto(ref: string | null | undefined): FuenteImagen | null {
  if (!ref) return null;
  if (ref.startsWith("local:")) {
    const source = LOCALES[ref.slice("local:".length)];
    // Las fotos de producto con fondo blanco se muestran completas, sin recortar el envase.
    return source ? { source, resizeMode: "contain" } : null;
  }
  return { source: { uri: ref }, resizeMode: "cover" };
}
