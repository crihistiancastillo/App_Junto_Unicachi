import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import type { PedidoGrupal } from "../../api/types";
import { AvatarStack, Button, Card, ErrorBox, Icon, Loading, Pill, Progress, s, Screen } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts, soles, tiempoRestante } from "../../theme";
import { imagenProducto } from "../../theme/imagenes";

type Detalle = PedidoGrupal & {
  participaciones: { id: string; comerciante_id: string; nombre_comercial: string; items: { producto_id: string; cantidad: number }[] }[];
  mi_participacion: { id: string; subtotal: number; estado_pago: string; items: { producto_id: string; cantidad: number; precio_unitario: number }[] } | null;
  entrega: { fecha_programada: string; estado: string; direccion: string } | null;
};

/** Escalera de descuentos: muestra en qué tramo está el pedido y el siguiente. */
function Tramos({ pedido, extra }: { pedido: Detalle; extra: number }) {
  const total = pedido.unidades + extra;
  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      {pedido.tramos.map((t) => {
        const alcanzado = total >= t.cantidad_minima;
        return (
          <View key={t.cantidad_minima} style={[s.row, { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
            backgroundColor: alcanzado ? colors.brandSoft : colors.canvas, borderWidth: 1, borderColor: alcanzado ? colors.brandSoft : colors.line }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name={alcanzado ? "check-circle" : "circle"} size={17} color={alcanzado ? colors.brand : colors.muted} />
              <Text style={[s.body, alcanzado && s.strong]}>Desde {t.cantidad_minima} unidades</Text>
            </View>
            <Text style={{ fontFamily: fonts.bodyBold, color: alcanzado ? colors.brand : colors.muted }}>
              {soles(pedido.precio_lista * (1 - t.porcentaje / 100))} · −{t.porcentaje}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const btn = (icon: "minus" | "plus", d: number) => (
    <Pressable accessibilityLabel={icon === "plus" ? "Aumentar" : "Disminuir"} onPress={() => onChange(Math.max(1, value + d))}
      style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      {btn("minus", -1)}
      <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 26, minWidth: 44, textAlign: "center", color: colors.ink }}>{value}</Text>
      {btn("plus", 1)}
    </View>
  );
}

export function OrderDetailScreen() {
  const nav = useNavigation<any>();
  const { id } = useRoute<any>().params;
  const { usuario } = useAuth();
  const { data: p, error, loading, reload } = useApi<Detalle>(`/pedidos-grupales/${id}`);
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const mia = p?.mi_participacion;
  const misUnidades = mia?.items.reduce((sum, i) => sum + i.cantidad, 0) ?? 0;
  useEffect(() => { if (misUnidades) setCantidad(misUnidades); }, [misUnidades]);

  if (error) return <Screen><ErrorBox message={error} onRetry={reload} /></Screen>;
  if (!p) return <Screen><Loading /></Screen>;

  const imagen = imagenProducto(p.imagen_url);
  const abierto = p.estado === "ABIERTO";
  const esCreador = p.creador_id === usuario?.id;
  const delta = abierto ? cantidad - misUnidades : 0;
  const estimado = cantidad * p.precio_lista;

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setEnviando(true);
    try {
      await fn();
      await reload();
      Alert.alert("Listo", ok);
    } catch (e) {
      Alert.alert("No se pudo completar", (e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const unirse = () => accion(
    () => api(`/pedidos-grupales/${p.id}/unirse`, { body: { items: [{ producto_id: p.producto_id, cantidad }] } }),
    mia ? "Actualizamos tu cantidad." : "Te uniste al pedido. Te avisaremos cuando cierre.",
  );
  const salir = () => Alert.alert("¿Salir del pedido?", "Tus unidades dejarán de contar para la meta.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Salir", style: "destructive", onPress: () => accion(() => api(`/pedidos-grupales/${p.id}/participacion`, { method: "DELETE" }), "Saliste del pedido.") },
  ]);
  const cerrar = () => Alert.alert("¿Cerrar el pedido ahora?", "Nadie más podrá unirse y lo enviaremos a negociar con el mayorista.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Cerrar pedido", onPress: () => accion(() => api(`/pedidos-grupales/${p.id}/cerrar`, { method: "POST" }), "Pedido cerrado.") },
  ]);

  return (
    <Screen padded={false} onRefresh={reload} refreshing={loading}>
      <View style={{ height: 210, backgroundColor: colors.brandSoft }}>
        {imagen && <Image source={imagen.source} resizeMode={imagen.resizeMode} style={{ width: "100%", height: "100%" }} />}
        <Pressable accessibilityLabel="Volver" onPress={() => nav.goBack()}
          style={{ position: "absolute", top: 14, left: 16, width: 42, height: 42, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
          <Icon name="arrow-left" />
        </Pressable>
      </View>

      <View style={{ padding: 20 }}>
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.brand }}>{p.mayorista} · {p.codigo}</Text>
            <Text style={[s.h1, { fontSize: 24, marginTop: 4 }]}>{p.producto}</Text>
            <Text style={s.small}>{p.unidad_medida} · {p.zona}</Text>
          </View>
          <Pill tone={p.estado === "OFERTA_ACEPTADA" ? "amber" : p.estado === "CANCELADO" ? "danger" : "green"}>{p.etiqueta_estado}</Pill>
        </View>

        <Card style={{ marginTop: 18 }}>
          <View style={s.row}>
            <Text style={s.strong}>{p.unidades} de {p.meta_unidades} unidades</Text>
            {abierto && <Text style={s.small}>{tiempoRestante(p.fecha_limite)}</Text>}
          </View>
          <View style={{ marginTop: 10 }}><Progress value={p.progreso} /></View>
          <View style={[s.row, { marginTop: 14 }]}>
            <AvatarStack names={p.nombres} total={p.participantes} />
            <Text style={s.small}>{p.participantes} comercios participan</Text>
          </View>
          {p.tramos.length > 0 && <Tramos pedido={p} extra={delta} />}
        </Card>

        {/* Acción principal según el estado del pedido */}
        {abierto && (
          <Card style={{ marginTop: 16 }}>
            <Text style={s.h3}>{mia ? "Tu parte del pedido" : "¿Cuántas unidades necesitas?"}</Text>
            <Text style={s.small}>Precio de lista {soles(p.precio_lista)}. El descuento final se aplica cuando el mayorista acepte.</Text>
            <View style={[s.row, { marginTop: 18 }]}>
              <Stepper value={cantidad} onChange={setCantidad} />
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.small}>Pagarías como máximo</Text>
                <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 20, color: colors.ink }}>{soles(estimado)}</Text>
              </View>
            </View>
            <Button title={mia ? "Actualizar cantidad" : "Unirme al pedido"} icon="check" style={{ marginTop: 18 }}
              loading={enviando} disabled={!!mia && delta === 0} onPress={unirse} />
            {mia && !esCreador && <Button title="Salir del pedido" variant="danger" small style={{ marginTop: 10 }} onPress={salir} />}
            {esCreador && <Button title="Cerrar pedido ahora" variant="secondary" small style={{ marginTop: 10 }} onPress={cerrar} />}
          </Card>
        )}

        {mia && p.estado === "OFERTA_ACEPTADA" && mia.estado_pago !== "APROBADO" && (
          <Card style={{ marginTop: 16, backgroundColor: colors.amberSoft, borderColor: colors.amberSoft }}>
            <Text style={s.h3}>¡Descuento conseguido!</Text>
            <Text style={[s.body, { marginTop: 6 }]}>
              Tu parte quedó en {soles(mia.subtotal)} ({misUnidades} × {soles(mia.items[0]?.precio_unitario)}). Paga para confirmar tu pedido.
            </Text>
            <Button title={`Pagar ${soles(mia.subtotal)}`} icon="credit-card" style={{ marginTop: 16 }}
              onPress={() => nav.navigate("Pago", { participacionId: mia.id, monto: mia.subtotal, codigo: p.codigo })} />
          </Card>
        )}

        {mia?.estado_pago === "APROBADO" && (
          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={s.iconTile}><Icon name={p.entrega ? "truck" : "check"} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.strong}>Pagaste {soles(mia.subtotal)}</Text>
                <Text style={s.small}>
                  {p.entrega
                    ? `Entrega ${p.entrega.estado === "ENTREGADA" ? "realizada" : `el ${new Date(p.entrega.fecha_programada).toLocaleDateString("es-PE")}`} · ${p.entrega.direccion}`
                    : "El mayorista programará la entrega cuando todos paguen."}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {["CERRADO", "CONSOLIDADO"].includes(p.estado) && (
          <Card style={{ marginTop: 16 }}>
            <Text style={s.strong}>Estamos negociando con {p.mayorista}</Text>
            <Text style={s.small}>Juntamos tu pedido con otros de zonas cercanas para conseguir un mejor tramo. Te avisaremos apenas responda.</Text>
          </Card>
        )}

        <Text style={[s.h3, { marginTop: 24, marginBottom: 10 }]}>Participantes</Text>
        {p.participaciones.map((pa) => (
          <View key={pa.id} style={[s.row, { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <Text style={s.body}>{pa.nombre_comercial}{pa.comerciante_id === usuario?.id ? " (tú)" : ""}</Text>
            <Text style={s.strong}>{pa.items.reduce((sum, i) => sum + i.cantidad, 0)} u.</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
