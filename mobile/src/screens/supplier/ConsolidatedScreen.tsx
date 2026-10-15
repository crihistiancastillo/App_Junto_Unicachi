import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import { Button, Card, Empty, Loading, PageTitle, Pill, s, Screen } from "../../components/ui";
import { soles } from "../../theme";

const tono = (c: any) => (c.estado_oferta === "PENDIENTE" ? "amber" : c.estado === "RECHAZADO" ? "danger" : "green");
const etiqueta = (c: any) =>
  c.estado_oferta === "PENDIENTE" ? "Por responder" : c.estado === "RECHAZADO" ? "Rechazado"
  : c.estado_entrega === "ENTREGADA" ? "Entregado" : c.estado_entrega ? "Entrega programada" : "Aceptado";

/** Revisar pedido consolidado. */
export function ConsolidatedScreen() {
  const nav = useNavigation<any>();
  const { data, loading, reload } = useApi<any[]>("/mayorista/consolidados");
  const [consolidando, setConsolidando] = useState(false);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const consolidarAhora = async () => {
    setConsolidando(true);
    try {
      const nuevos = await api<any[]>("/mayorista/consolidar", { method: "POST" });
      Alert.alert(nuevos.length ? "Pedidos consolidados" : "Nada por consolidar",
        nuevos.length ? `Se generaron ${nuevos.length} pedido(s) consolidado(s).` : "No hay pedidos cerrados pendientes.");
      reload();
    } finally {
      setConsolidando(false);
    }
  };

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Pedidos de comunidades" title="Consolidados"
        subtitle="Agrupamos los pedidos cerrados de zonas cercanas para que despaches en una sola ruta." />
      <Button title="Consolidar pedidos cerrados" icon="layers" variant="secondary" loading={consolidando} onPress={consolidarAhora} style={{ marginBottom: 18 }} />
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty icon="layers" title="Sin pedidos consolidados" text="Aparecerán cuando las comunidades cierren sus pedidos." />}
      {data?.map((c) => (
        <Card key={c.id} style={{ marginBottom: 12 }} onPress={() => nav.navigate("DetalleConsolidado", { id: c.id })}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={s.strong}>{c.zonas || "Varias zonas"}</Text>
              <Text style={s.small}>{c.pedidos} pedidos · {c.total_unidades} unidades</Text>
            </View>
            <Pill tone={tono(c)}>{etiqueta(c)}</Pill>
          </View>
          <View style={[s.row, { marginTop: 12 }]}>
            <Text style={s.small}>−{c.porcentaje_descuento}% por volumen</Text>
            <Text style={s.strong}>{soles(c.monto_neto)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
