import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { useApi } from "../../api/client";
import type { Producto } from "../../api/types";
import { Button, Card, Icon, PageTitle, Pill, Progress, s, Screen, SectionHeading, Stat } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, soles } from "../../theme";

type Resumen = { ventas_mes: number; pedidos_abiertos: number; ofertas_por_responder: number; comerciantes: number; entregas_a_tiempo: number | null };

export function DashboardScreen() {
  const nav = useNavigation<any>();
  const { usuario } = useAuth();
  const resumen = useApi<Resumen>("/mayorista/resumen");
  const consolidados = useApi<any[]>("/mayorista/consolidados");
  const productos = useApi<Producto[]>("/mayorista/productos");
  const recargar = () => { resumen.reload(); consolidados.reload(); productos.reload(); };
  useFocusEffect(useCallback(recargar, []));

  const r = resumen.data;
  const pendientes = consolidados.data?.filter((c) => c.estado_oferta === "PENDIENTE") ?? [];
  const proxima = consolidados.data?.find((c) => c.entrega_id && c.estado_entrega !== "ENTREGADA");

  return (
    <Screen onRefresh={recargar} refreshing={resumen.loading}>
      <PageTitle eyebrow="Panel del mayorista" title={`Hola, ${usuario?.nombre.split(" ")[0]}`}
        subtitle="Revisa los pedidos que las comunidades armaron para ti." />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat value={r ? soles(r.ventas_mes) : "—"} label="Ventas del mes" icon="bar-chart-2" />
        <Stat value={r ? String(r.comerciantes) : "—"} label="Comercios" icon="users" />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Stat value={r ? String(r.pedidos_abiertos) : "—"} label="Pedidos armándose" icon="package" />
        <Stat value={r?.entregas_a_tiempo != null ? `${r.entregas_a_tiempo}%` : "—"} label="Entregas a tiempo" icon="truck" />
      </View>

      <SectionHeading eyebrow="Por responder" title="Pedidos consolidados" action="Ver todos" onAction={() => nav.navigate("Consolidados")} />
      {pendientes.length === 0 ? (
        <Card><Text style={s.small}>No tienes ofertas pendientes. Cuando una comunidad cierre un pedido, aparecerá aquí.</Text></Card>
      ) : pendientes.map((c) => (
        <Card key={c.id} style={{ marginBottom: 12 }} onPress={() => nav.navigate("DetalleConsolidado", { id: c.id })}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.strong}>{c.total_unidades} unidades · {c.pedidos} pedidos</Text>
              <Text style={s.small}>{c.zonas}</Text>
            </View>
            <Pill tone="amber">Responder</Pill>
          </View>
          <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 22, color: colors.ink, marginTop: 12 }}>{soles(c.monto_neto)}</Text>
          <Text style={s.small}>Descuento por volumen: {c.porcentaje_descuento}%</Text>
        </Card>
      ))}

      {proxima && (
        <View style={{ marginTop: 16, borderRadius: 28, padding: 22, backgroundColor: "#d78c4a" }}>
          <Icon name="truck" color={colors.white} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 18 }}>Próxima entrega</Text>
          <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 22, color: colors.white, marginTop: 4 }}>{proxima.zonas}</Text>
          <Text style={{ fontFamily: fonts.body, color: "rgba(255,255,255,.85)", marginTop: 4 }}>
            {new Date(proxima.fecha_programada).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })} · {proxima.total_unidades} unidades
          </Text>
          <Button title="Gestionar entrega" variant="light" small style={{ marginTop: 16, alignSelf: "flex-start" }}
            onPress={() => nav.navigate("DetalleConsolidado", { id: proxima.id })} />
        </View>
      )}

      <SectionHeading eyebrow="Demanda en curso" title="Tus productos" action="Catálogo" onAction={() => nav.navigate("Catalogo")} />
      <Card>
        {productos.data?.filter((p) => p.activo).slice(0, 4).map((p, i) => {
          const meta = p.tramos.at(-1)?.cantidad_minima ?? 1;
          return (
            <View key={p.id} style={[{ paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <View style={s.row}>
                <Text style={[s.strong, { flex: 1 }]}>{p.nombre}</Text>
                <Text style={[s.small, { color: colors.brand }]}>{p.comprometidas} comprometidas</Text>
              </View>
              <View style={{ marginTop: 8 }}><Progress value={((p.comprometidas ?? 0) / meta) * 100} /></View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
