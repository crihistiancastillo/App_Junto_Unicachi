import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import type { Producto } from "../../api/types";
import { Button, Card, Chips, Field, Icon, Loading, PageTitle, s, Screen } from "../../components/ui";
import { colors, fonts, soles } from "../../theme";

type Sugerencia = { producto_id: string; producto: string; unidad_medida: string; mayorista: string; cantidad_estimada: number; confianza: number };
type Plazo = "1" | "2" | "3" | "5";

/** Crear pedido grupal (con «extend» Ver demanda sugerida por zona). */
export function CreateOrderScreen() {
  const nav = useNavigation<any>();
  const productos = useApi<Producto[]>("/productos");
  const sugerida = useApi<Sugerencia[]>("/demanda/sugerida");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [productoId, setProductoId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("5");
  const [meta, setMeta] = useState("");
  const [plazo, setPlazo] = useState<Plazo>("2");
  const [nota, setNota] = useState("");
  const [publicando, setPublicando] = useState(false);

  const categorias = useMemo(() => ["Todas", ...new Set((productos.data ?? []).map((p) => p.categoria))], [productos.data]);
  const visibles = (productos.data ?? []).filter((p) =>
    (categoria === "Todas" || p.categoria === categoria) && p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  const producto = productos.data?.find((p) => p.id === productoId);
  const tramoMax = producto?.tramos.at(-1);

  const elegir = (p: Producto, metaSugerida?: number) => {
    setProductoId(p.id);
    // La meta por defecto es el tramo de mayor descuento (o la demanda estimada si es mayor).
    setMeta(String(Math.max(metaSugerida ?? 0, p.tramos.at(-1)?.cantidad_minima ?? 10)));
  };

  const errores = {
    cantidad: Number(cantidad) > 0 ? null : "Indica cuántas unidades necesitas.",
    meta: Number(meta) >= Number(cantidad) ? null : "La meta debe ser igual o mayor que tu cantidad.",
  };
  const valido = !!producto && !errores.cantidad && !errores.meta;

  const publicar = async () => {
    if (!producto) return;
    setPublicando(true);
    try {
      const limite = new Date(Date.now() + Number(plazo) * 86_400_000);
      limite.setHours(18, 0, 0, 0);
      const creado = await api<{ id: string; codigo: string }>("/pedidos-grupales", {
        body: { items: [{ producto_id: producto.id, cantidad: Number(cantidad) }], meta_unidades: Number(meta), fecha_limite: limite.toISOString(), nota: nota || undefined },
      });
      nav.replace("DetallePedido", { id: creado.id });
    } catch (e) {
      Alert.alert("No se pudo publicar", (e as Error).message);
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Screen>
      <PageTitle eyebrow="Nuevo pedido comunitario" title="¿Qué necesitan comprar juntos?" subtitle="Lo publicaremos en tu comunidad para que otros comercios se sumen." />

      {!!sugerida.data?.length && (
        <>
          <Text style={[s.label, { marginBottom: 10 }]}>Demanda estimada en tu zona esta semana</Text>
          {sugerida.data.slice(0, 3).map((sug) => {
            const p = productos.data?.find((x) => x.id === sug.producto_id);
            return (
              <Pressable key={sug.producto_id} disabled={!p} onPress={() => p && elegir(p, sug.cantidad_estimada)}
                style={[s.row, { padding: 14, borderRadius: 16, marginBottom: 8, backgroundColor: productoId === sug.producto_id ? colors.brandSoft : colors.white, borderWidth: 1, borderColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.strong}>{sug.producto}</Text>
                  <Text style={s.small}>{sug.mayorista} · confianza {Math.round(sug.confianza * 100)}%</Text>
                </View>
                <Text style={{ fontFamily: fonts.display, color: colors.brand }}>~{sug.cantidad_estimada}</Text>
              </Pressable>
            );
          })}
        </>
      )}

      <Text style={[s.label, { marginTop: 16 }]}>Producto del catálogo</Text>
      <Field label="" placeholder="Buscar producto" value={busqueda} onChangeText={setBusqueda} />
      <Chips value={categoria} onChange={setCategoria} options={categorias.map((c) => ({ value: c, label: c }))} />
      <View style={{ marginTop: 12 }}>
        {productos.loading && <Loading />}
        {visibles.map((p) => {
          const activo = p.id === productoId;
          return (
            <Pressable key={p.id} onPress={() => elegir(p)}
              style={[s.row, { padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1.5, backgroundColor: colors.white, borderColor: activo ? colors.brand : colors.line }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.strong}>{p.nombre}</Text>
                <Text style={s.small}>{p.mayorista} · {p.unidad_medida}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.strong}>{soles(p.precio_unitario)}</Text>
                {p.tramos.length > 0 && <Text style={[s.small, { color: colors.brand }]}>hasta −{p.tramos.at(-1)!.porcentaje}%</Text>}
              </View>
              {activo && <View style={{ marginLeft: 10 }}><Icon name="check-circle" color={colors.brand} /></View>}
            </Pressable>
          );
        })}
      </View>

      {producto && (
        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Tu cantidad" keyboardType="number-pad" value={cantidad} onChangeText={setCantidad} error={errores.cantidad} /></View>
            <View style={{ flex: 1 }}><Field label="Meta del grupo" keyboardType="number-pad" value={meta} onChangeText={setMeta} error={errores.meta} /></View>
          </View>
          {tramoMax && (
            <Text style={[s.small, { marginTop: -6, marginBottom: 14 }]}>
              Con {tramoMax.cantidad_minima} unidades el precio baja a {soles(producto.precio_unitario * (1 - tramoMax.porcentaje / 100))}.
            </Text>
          )}
          <Text style={s.label}>Cierra en</Text>
          <Chips<Plazo> value={plazo} onChange={setPlazo}
            options={[{ value: "1", label: "1 día" }, { value: "2", label: "2 días" }, { value: "3", label: "3 días" }, { value: "5", label: "5 días" }]} />
          <View style={{ height: 16 }} />
          <Field label="Detalles (opcional)" placeholder="Calidad, presentación o condiciones de entrega…" multiline value={nota} onChangeText={setNota} />
          <Button title="Publicar pedido" icon="check" disabled={!valido} loading={publicando} onPress={publicar} />
        </Card>
      )}
    </Screen>
  );
}
