import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { useApi } from "../../api/client";
import type { PedidoGrupal } from "../../api/types";
import { Button, Card, Empty, ErrorBox, Icon, Loading, PageTitle, Pill, Progress, s, Screen } from "../../components/ui";
import { colors, soles, tiempoRestante } from "../../theme";

const icono = (e: string) => (e === "EN_REPARTO" ? "truck" : e === "OFERTA_ACEPTADA" ? "credit-card" : e === "ENTREGADO" ? "check" : "package");

/** Seguir estado del pedido. */
export function OrdersScreen() {
  const nav = useNavigation<any>();
  const { data, error, loading, reload } = useApi<PedidoGrupal[]>("/pedidos-grupales/mios");
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Seguimiento" title="Mis pedidos" subtitle="Revisa tus compras colectivas y próximas entregas."
        right={<Button title="Crear" icon="plus" small onPress={() => nav.navigate("CrearPedido")} />} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data?.length === 0 && (
        <Empty icon="package" title="Todavía no participas en pedidos" text="Únete a uno de tu zona o crea el tuyo."
          action="Crear pedido" onAction={() => nav.navigate("CrearPedido")} />
      )}
      {data?.map((p) => {
        const pagar = p.estado === "OFERTA_ACEPTADA" && p.mi_participacion?.estado_pago !== "APROBADO";
        return (
          <Card key={p.id} style={{ marginBottom: 12 }} onPress={() => nav.navigate("DetallePedido", { id: p.id })}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={[s.iconTile, { width: 52, height: 52, borderRadius: 16 }, pagar && { backgroundColor: colors.amberSoft }]}>
                <Icon name={icono(p.estado)} color={pagar ? colors.amber : colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={[s.row, { alignItems: "flex-start" }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.strong}>{p.producto}</Text>
                    <Text style={s.small}>
                      {p.mayorista} · {p.estado === "ABIERTO" ? tiempoRestante(p.fecha_limite) : p.codigo}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text style={s.strong}>{soles(p.mi_participacion?.subtotal)}</Text>
                    <Pill tone={pagar ? "amber" : p.estado === "CANCELADO" ? "danger" : "green"}>{pagar ? "Paga tu parte" : p.etiqueta_estado}</Pill>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}><Progress value={p.progreso} color={pagar ? colors.amber : colors.brand} /></View>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
