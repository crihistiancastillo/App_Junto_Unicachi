import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { useApi } from "../../api/client";
import type { Producto } from "../../api/types";
import { Button, Card, Empty, Icon, Loading, PageTitle, Pill, s, Screen } from "../../components/ui";
import { colors, soles } from "../../theme";

/** Publicar productos y precios + Definir descuentos por volumen ("Mis ofertas" del prototipo). */
export function CatalogScreen() {
  const nav = useNavigation<any>();
  const { data, loading, reload } = useApi<Producto[]>("/mayorista/productos");
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Catálogo mayorista" title="Mis productos" subtitle="Precios de lista y descuentos por volumen para compras colectivas."
        right={<Button title="Nuevo" icon="plus" small onPress={() => nav.navigate("EditarProducto", {})} />} />
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty icon="package" title="Publica tu primer producto" text="Las comunidades solo pueden pedir lo que está en tu catálogo."
        action="Nuevo producto" onAction={() => nav.navigate("EditarProducto", {})} />}
      {data?.map((p) => (
        <Card key={p.id} style={{ marginBottom: 12 }} onPress={() => nav.navigate("EditarProducto", { producto: p })}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={s.iconTile}><Icon name="package" color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <View style={s.row}>
                <Text style={[s.strong, { flex: 1 }]}>{p.nombre}</Text>
                <Pill tone={p.activo ? "green" : "neutral"}>{p.activo ? "Publicado" : "Oculto"}</Pill>
              </View>
              <Text style={s.small}>{p.unidad_medida} · {soles(p.precio_unitario)} · stock {p.stock}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {p.tramos.length === 0 ? <Text style={[s.small, { color: colors.amber }]}>Sin descuentos por volumen</Text> :
                  p.tramos.map((t) => <Pill key={t.cantidad_minima} tone="neutral">{t.cantidad_minima}+ → −{t.porcentaje}%</Pill>)}
              </View>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
