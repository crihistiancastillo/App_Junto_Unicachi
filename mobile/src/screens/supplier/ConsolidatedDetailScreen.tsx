import { useRoute } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import { Button, Card, Chips, ErrorBox, Field, Loading, PageTitle, Pill, Progress, s, Screen } from "../../components/ui";
import { colors, fonts, soles } from "../../theme";

type Detalle = {
  id: string; estado: string; total_unidades: number; monto_bruto: number; monto_neto: number; porcentaje_descuento: number;
  productos: { id: string; nombre: string; unidad_medida: string; precio_lista: number; cantidad: number;
    desglose: { zona: string; comercio: string; cantidad: number }[] }[];
  oferta: { id: string; estado: string; motivo_rechazo: string | null } | null;
  entrega: { id: string; estado: string; fecha_programada: string; direccion: string } | null;
  pagos: { total: number; pagados: number };
};

const MOTIVOS = ["Sin stock suficiente", "Fuera de mi zona de reparto", "Precio no rentable"];

export function ConsolidatedDetailScreen() {
  const { id } = useRoute<any>().params;
  const { data: c, error, reload } = useApi<Detalle>(`/mayorista/consolidados/${id}`);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [rechazando, setRechazando] = useState(false);
  const [fecha, setFecha] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [direccion, setDireccion] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const ejecutar = async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      Alert.alert("No se pudo completar", (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (error) return <Screen><ErrorBox message={error} onRetry={reload} /></Screen>;
  if (!c) return <Screen><Loading /></Screen>;
  const pendiente = c.oferta?.estado === "PENDIENTE";
  const zonas = [...new Set(c.productos.flatMap((p) => p.desglose.map((d) => d.zona)))];

  return (
    <Screen onRefresh={reload}>
      <PageTitle eyebrow="Pedido consolidado" title={`${c.total_unidades} unidades`} subtitle={zonas.join(" + ")} />

      <Card>
        <View style={s.row}>
          <Text style={s.small}>Precio de lista</Text>
          <Text style={[s.body, { textDecorationLine: "line-through" }]}>{soles(c.monto_bruto)}</Text>
        </View>
        <View style={[s.row, { marginTop: 6 }]}>
          <Text style={s.small}>Descuento por volumen</Text>
          <Text style={[s.strong, { color: colors.brand }]}>−{c.porcentaje_descuento}%</Text>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.strong}>Total a cobrar</Text>
          <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 24, color: colors.ink }}>{soles(c.monto_neto)}</Text>
        </View>
      </Card>

      <Text style={[s.h3, { marginTop: 24, marginBottom: 10 }]}>Productos</Text>
      {c.productos.map((p) => (
        <Card key={p.id} style={{ marginBottom: 10 }}>
          <View style={s.row}>
            <Text style={[s.strong, { flex: 1 }]}>{p.nombre}</Text>
            <Text style={s.strong}>{p.cantidad} × {p.unidad_medida}</Text>
          </View>
          {p.desglose.map((d, i) => (
            <View key={i} style={[s.row, { marginTop: 8 }]}>
              <Text style={s.small}>{d.comercio} · {d.zona}</Text>
              <Text style={s.small}>{d.cantidad}</Text>
            </View>
          ))}
        </Card>
      ))}

      {/* Aceptar o rechazar oferta */}
      {pendiente && c.oferta && (
        <Card style={{ marginTop: 14 }}>
          {!rechazando ? (
            <>
              <Text style={s.h3}>¿Aceptas este pedido?</Text>
              <Text style={s.small}>Al aceptar, cada comercio pagará su parte y luego podrás programar la entrega.</Text>
              <Button title={`Aceptar por ${soles(c.monto_neto)}`} icon="check" style={{ marginTop: 16 }} loading={ocupado}
                onPress={() => ejecutar(() => api(`/mayorista/ofertas/${c.oferta!.id}/aceptar`, { method: "POST" }))} />
              <Button title="Rechazar" variant="danger" small style={{ marginTop: 10 }} onPress={() => setRechazando(true)} />
            </>
          ) : (
            <>
              <Text style={[s.h3, { marginBottom: 12 }]}>Motivo del rechazo</Text>
              <Chips value={motivo} onChange={setMotivo} options={MOTIVOS.map((m) => ({ value: m, label: m }))} />
              <Text style={[s.small, { marginTop: 12 }]}>Los comercios verán este motivo y no se les cobrará nada.</Text>
              <Button title="Confirmar rechazo" variant="danger" style={{ marginTop: 16 }} loading={ocupado}
                onPress={() => ejecutar(() => api(`/mayorista/ofertas/${c.oferta!.id}/rechazar`, { body: { motivo } }))} />
              <Button title="Volver" variant="secondary" small style={{ marginTop: 10 }} onPress={() => setRechazando(false)} />
            </>
          )}
        </Card>
      )}

      {c.oferta?.estado === "RECHAZADA" && (
        <Card style={{ marginTop: 14 }}><Pill tone="danger">Rechazado</Pill><Text style={[s.small, { marginTop: 8 }]}>{c.oferta.motivo_rechazo}</Text></Card>
      )}

      {/* Gestionar entregas */}
      {c.estado === "ACEPTADO" && (
        <Card style={{ marginTop: 14 }}>
          <View style={s.row}>
            <Text style={s.h3}>Pagos de los comercios</Text>
            <Text style={s.strong}>{c.pagos.pagados}/{c.pagos.total}</Text>
          </View>
          <View style={{ marginTop: 10 }}><Progress value={(c.pagos.pagados / Math.max(1, c.pagos.total)) * 100} /></View>
          <View style={s.divider} />
          {!c.entrega ? (
            <>
              <Text style={[s.h3, { marginBottom: 12 }]}>Programar entrega</Text>
              <Field label="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} />
              <Field label="Punto de entrega" value={direccion} onChangeText={setDireccion} placeholder="UNICACHI, puerta principal" />
              <Button title="Programar entrega" icon="calendar" loading={ocupado} disabled={direccion.length < 5}
                onPress={() => ejecutar(() => api(`/mayorista/consolidados/${c.id}/entrega`, { body: { fecha_programada: fecha, direccion } }))} />
            </>
          ) : (
            <>
              <View style={s.row}>
                <Text style={s.h3}>Entrega</Text>
                <Pill tone={c.entrega.estado === "ENTREGADA" ? "green" : "amber"}>{c.entrega.estado.replace("_", " ").toLowerCase()}</Pill>
              </View>
              <Text style={[s.small, { marginTop: 6 }]}>
                {new Date(c.entrega.fecha_programada).toLocaleDateString("es-PE")} · {c.entrega.direccion}
              </Text>
              {c.entrega.estado === "PROGRAMADA" && (
                <Button title="Salió a reparto" icon="truck" style={{ marginTop: 14 }} loading={ocupado}
                  disabled={c.pagos.pagados < c.pagos.total}
                  onPress={() => ejecutar(() => api(`/mayorista/entregas/${c.entrega!.id}`, { method: "PATCH", body: { estado: "EN_CAMINO" } }))} />
              )}
              {c.entrega.estado === "EN_CAMINO" && (
                <Button title="Marcar como entregado" icon="check" style={{ marginTop: 14 }} loading={ocupado}
                  onPress={() => ejecutar(() => api(`/mayorista/entregas/${c.entrega!.id}`, { method: "PATCH", body: { estado: "ENTREGADA" } }))} />
              )}
              {c.pagos.pagados < c.pagos.total && c.entrega.estado === "PROGRAMADA" && (
                <Text style={[s.small, { marginTop: 8 }]}>Podrás despachar cuando todos los comercios hayan pagado.</Text>
              )}
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
