import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../../api/client";
import type { PedidoGrupal } from "../../api/types";
import { CollectiveCard } from "../../components/CollectiveCard";
import { Button, Card, Empty, ErrorBox, Icon, Loading, Pill, s, Screen, SectionHeading, Stat } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, soles } from "../../theme";

const marketPhoto = "https://images.unsplash.com/photo-1678294077054-76966b0a6dac?auto=format&fit=crop&w=1200&q=85";

export function HomeScreen() {
  const nav = useNavigation<any>();
  const { usuario } = useAuth();
  const resumen = useApi<{ ahorro: number; activos: number; aliados: number; oportunidades: number }>("/comerciante/resumen");
  const pedidos = useApi<PedidoGrupal[]>("/pedidos-grupales?estado=ABIERTO");
  const sugerida = useApi<any[]>("/demanda/sugerida");

  useFocusEffect(useCallback(() => { resumen.reload(); pedidos.reload(); }, []));
  const refrescar = () => { resumen.reload(); pedidos.reload(); sugerida.reload(); };
  const r = resumen.data;

  return (
    <Screen onRefresh={refrescar} refreshing={pedidos.loading}>
      <View style={[s.row, { marginBottom: 18 }]}>
        <View>
          <Text style={s.small}>Hola,</Text>
          <Text style={s.h2}>{usuario?.nombre.split(" ")[0]}</Text>
        </View>
        <Pressable accessibilityLabel="Notificaciones" onPress={() => nav.navigate("Notificaciones")}
          style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
          <Icon name="bell" size={19} />
        </Pressable>
      </View>

      {/* Hero del prototipo: el mensaje central de la app */}
      <View style={{ borderRadius: 28, overflow: "hidden", backgroundColor: colors.brandDark, padding: 24 }}>
        <Image source={{ uri: marketPhoto }} style={[StyleSheet.absoluteFillObject, { opacity: 0.18 }]} />
        <Pill tone="amber">{r ? `${r.oportunidades} oportunidades cerca de ti` : "Compras colectivas"}</Pill>
        <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 34, color: colors.white, marginTop: 16 }}>
          Compra más, pagando menos.
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: "rgba(255,255,255,.75)", marginTop: 10 }}>
          Únete a otros comercios de tu zona y alcanza precios mayoristas sin comprar de más.
        </Text>
        <Button title="Crear pedido grupal" icon="plus" variant="light" style={{ marginTop: 20, alignSelf: "flex-start" }}
          onPress={() => nav.navigate("CrearPedido")} />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <Stat value={r ? soles(r.ahorro) : "—"} label="Ahorro reciente" icon="tag" />
        <Stat value={r ? String(r.activos) : "—"} label="Pedidos activos" icon="package" />
        <Stat value={r ? String(r.aliados) : "—"} label="Comercios aliados" icon="users" />
      </View>

      {!!sugerida.data?.length && (
        <Card style={{ marginTop: 18, backgroundColor: colors.brandTint, borderColor: colors.brandTint }}
          onPress={() => nav.navigate("CrearPedido")}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={[s.iconTile, { backgroundColor: colors.white }]}><Icon name="trending-up" color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.strong}>Esta semana tu zona necesitará</Text>
              <Text style={s.small}>
                ~{sugerida.data[0].cantidad_estimada} {sugerida.data[0].unidad_medida.split(" ")[0]}s de {sugerida.data[0].producto}. Arma el pedido antes que nadie.
              </Text>
            </View>
            <Icon name="chevron-right" color={colors.muted} />
          </View>
        </Card>
      )}

      <SectionHeading eyebrow="En tu zona" title="Pedidos por completar" action="Ver mis pedidos" onAction={() => nav.navigate("Pedidos")} />
      {pedidos.error && <ErrorBox message={pedidos.error} onRetry={pedidos.reload} />}
      {pedidos.loading && !pedidos.data && <Loading />}
      {pedidos.data?.length === 0 && (
        <Empty icon="users" title="Aún no hay pedidos abiertos" text="Crea el primero y tus vecinos podrán sumarse."
          action="Crear pedido" onAction={() => nav.navigate("CrearPedido")} />
      )}
      {pedidos.data?.map((p) => (
        <CollectiveCard key={p.id} pedido={p} onPress={() => nav.navigate("DetallePedido", { id: p.id })} />
      ))}
    </Screen>
  );
}
