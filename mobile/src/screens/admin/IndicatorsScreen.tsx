import { Alert, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import { Button, Card, Loading, PageTitle, Progress, s, Screen, SectionHeading } from "../../components/ui";
import { colors, fonts, soles } from "../../theme";

type Indicadores = {
  global: { descuento_promedio: number | null; horas_promedio_armado: number | null; pedidos_completados: number;
    ahorro_total: number; comercios: number; mayoristas_por_verificar: number };
  por_zona: { nombre: string; pedidos: number; descuento_promedio: number | null }[];
};

function Indicador({ valor, etiqueta, detalle }: { valor: string; etiqueta: string; detalle: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 30, color: colors.brand }}>{valor}</Text>
      <Text style={[s.strong, { marginTop: 4 }]}>{etiqueta}</Text>
      <Text style={s.small}>{detalle}</Text>
    </Card>
  );
}

/** Ver indicadores (% descuento, tiempo de armado) — métricas de éxito del caso. */
export function IndicatorsScreen() {
  const { data, loading, reload } = useApi<Indicadores>("/admin/indicadores");
  const reentrenar = async () => {
    try {
      const r = await api<{ confianza: number }>("/admin/ml/entrenar", { method: "POST" });
      Alert.alert("Modelo actualizado", `Confianza de la predicción: ${Math.round(r.confianza * 100)}%.`);
    } catch (e) {
      Alert.alert("No se pudo reentrenar", (e as Error).message);
    }
  };
  if (!data) return <Screen><Loading /></Screen>;
  const g = data.global;
  const maxPedidos = Math.max(1, ...data.por_zona.map((z) => z.pedidos));

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Administración" title="Indicadores" subtitle="¿Comprar juntos está funcionando?" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Indicador valor={g.descuento_promedio != null ? `${g.descuento_promedio}%` : "—"} etiqueta="Descuento promedio" detalle="obtenido por compra colectiva" />
        <Indicador valor={g.horas_promedio_armado != null ? `${g.horas_promedio_armado} h` : "—"} etiqueta="Tiempo de armado" detalle="desde que se crea hasta que cierra" />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Indicador valor={soles(g.ahorro_total)} etiqueta="Ahorro generado" detalle={`${g.pedidos_completados} pedidos entregados`} />
        <Indicador valor={String(g.comercios)} etiqueta="Comercios" detalle={`${g.mayoristas_por_verificar} mayoristas por verificar`} />
      </View>

      <SectionHeading title="Actividad por zona" />
      <Card>
        {data.por_zona.map((z, i) => (
          <View key={z.nombre} style={[{ paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <View style={s.row}>
              <Text style={s.strong}>{z.nombre}</Text>
              <Text style={s.small}>{z.pedidos} pedidos · {z.descuento_promedio ?? "—"}%</Text>
            </View>
            <View style={{ marginTop: 8 }}><Progress value={(z.pedidos / maxPedidos) * 100} /></View>
          </View>
        ))}
      </Card>
      <Button title="Reentrenar predicción de demanda" icon="cpu" variant="secondary" style={{ marginTop: 20 }} onPress={reentrenar} />
    </Screen>
  );
}
