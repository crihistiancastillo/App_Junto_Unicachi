import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { api } from "../../api/client";
import type { Producto } from "../../api/types";
import { Button, Card, Field, Icon, PageTitle, s, Screen } from "../../components/ui";
import { colors, soles } from "../../theme";

type TramoForm = { min: string; pct: string };

export function ProductEditScreen() {
  const nav = useNavigation<any>();
  const original: Producto | undefined = useRoute<any>().params?.producto;
  const [f, setF] = useState({
    sku: original?.sku ?? "", nombre: original?.nombre ?? "", categoria: original?.categoria ?? "Abarrotes",
    unidad_medida: original?.unidad_medida ?? "", precio: original ? String(original.precio_unitario) : "",
    stock: original ? String(original.stock) : "0", activo: original?.activo ?? true,
  });
  const [tramos, setTramos] = useState<TramoForm[]>(
    original?.tramos.map((t) => ({ min: String(t.cantidad_minima), pct: String(t.porcentaje) })) ?? [{ min: "10", pct: "5" }],
  );
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const precio = Number(f.precio);

  const guardar = async () => {
    setGuardando(true);
    try {
      const body = { sku: f.sku, nombre: f.nombre, categoria: f.categoria, unidad_medida: f.unidad_medida,
        precio_unitario: precio, stock: Number(f.stock), activo: f.activo };
      const prod = original
        ? await api<Producto>(`/mayorista/productos/${original.id}`, { method: "PATCH", body })
        : await api<Producto>("/mayorista/productos", { body });
      // Cada tramo termina donde empieza el siguiente; el último no tiene tope.
      const ordenados = tramos.filter((t) => Number(t.min) > 0 && Number(t.pct) > 0).sort((a, b) => Number(a.min) - Number(b.min));
      await api(`/mayorista/productos/${prod.id}/descuentos`, {
        method: "PUT",
        body: ordenados.map((t, i) => ({
          cantidad_minima: Number(t.min),
          cantidad_maxima: ordenados[i + 1] ? Number(ordenados[i + 1].min) - 1 : null,
          porcentaje: Number(t.pct),
        })),
      });
      nav.goBack();
    } catch (e) {
      Alert.alert("No se pudo guardar", (e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Screen>
      <PageTitle eyebrow="Catálogo" title={original ? "Editar producto" : "Nuevo producto"} />
      <Card>
        <Field label="Nombre" value={f.nombre} onChangeText={set("nombre")} placeholder="Arroz superior" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="SKU" autoCapitalize="characters" value={f.sku} onChangeText={set("sku")} /></View>
          <View style={{ flex: 1 }}><Field label="Categoría" value={f.categoria} onChangeText={set("categoria")} /></View>
        </View>
        <Field label="Presentación" value={f.unidad_medida} onChangeText={set("unidad_medida")} placeholder="saco 50 kg" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Precio de lista (S/)" keyboardType="decimal-pad" value={f.precio} onChangeText={set("precio")} /></View>
          <View style={{ flex: 1 }}><Field label="Stock" keyboardType="number-pad" value={f.stock} onChangeText={set("stock")} /></View>
        </View>
        <View style={s.row}>
          <Text style={s.body}>Visible para las comunidades</Text>
          <Switch value={f.activo} onValueChange={(activo) => setF({ ...f, activo })} trackColor={{ true: colors.brand }} />
        </View>
      </Card>

      <Text style={[s.h3, { marginTop: 24 }]}>Descuentos por volumen</Text>
      <Text style={[s.small, { marginBottom: 12 }]}>Se aplican sobre el volumen combinado de todos los comercios del pedido.</Text>
      <Card>
        {tramos.map((t, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}><Field label="Desde (unid.)" keyboardType="number-pad" value={t.min}
              onChangeText={(min) => setTramos(tramos.map((x, j) => (j === i ? { ...x, min } : x)))} /></View>
            <View style={{ flex: 1 }}><Field label="Descuento %" keyboardType="decimal-pad" value={t.pct}
              hint={precio ? `= ${soles(precio * (1 - Number(t.pct) / 100))}` : undefined}
              onChangeText={(pct) => setTramos(tramos.map((x, j) => (j === i ? { ...x, pct } : x)))} /></View>
            <Pressable accessibilityLabel="Quitar tramo" onPress={() => setTramos(tramos.filter((_, j) => j !== i))} style={{ marginTop: 38 }}>
              <Icon name="trash-2" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        {tramos.length < 6 && (
          <Button title="Agregar tramo" icon="plus" variant="secondary" small
            onPress={() => setTramos([...tramos, { min: String((Number(tramos.at(-1)?.min) || 0) + 20), pct: String((Number(tramos.at(-1)?.pct) || 0) + 5) }])} />
        )}
      </Card>
      <Button title="Guardar" icon="check" style={{ marginTop: 20 }} loading={guardando}
        disabled={!f.nombre || !f.sku || !f.unidad_medida || !(precio > 0)} onPress={guardar} />
    </Screen>
  );
}
