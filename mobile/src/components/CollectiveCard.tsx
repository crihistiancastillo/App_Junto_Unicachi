import { Image, Text, View } from "react-native";
import type { PedidoGrupal } from "../api/types";
import { colors, fonts, soles, tiempoRestante } from "../theme";
import { imagenProducto } from "../theme/imagenes";
import { AvatarStack, Button, Card, Icon, Pill, Progress, s } from "./ui";

/** Tarjeta de "Pedidos por completar" (CollectiveCard del prototipo). */
export function CollectiveCard({ pedido, onPress }: { pedido: PedidoGrupal; onPress: () => void }) {
  const ahorro = pedido.descuento_maximo ? Math.round(pedido.descuento_maximo) : 0;
  const yaParticipo = !!pedido.mi_participacion;
  const imagen = imagenProducto(pedido.imagen_url);
  return (
    <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }} onPress={onPress}>
      <View style={{ height: 150, backgroundColor: colors.brandSoft }}>
        {imagen ? (
          <Image source={imagen.source} resizeMode={imagen.resizeMode} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Icon name="package" size={40} color={colors.brand} /></View>
        )}
        {ahorro > 0 && <View style={{ position: "absolute", left: 14, top: 14 }}><Pill tone="amber">Ahorra hasta {ahorro}%</Pill></View>}
        <View style={{ position: "absolute", left: 14, bottom: 14, flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: "rgba(255,255,255,.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Icon name="clock" size={12} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink }}>{tiempoRestante(pedido.fecha_limite)}</Text>
        </View>
      </View>
      <View style={{ padding: 18 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.brand, letterSpacing: 0.6 }}>{pedido.mayorista}</Text>
        <Text style={[s.h3, { marginTop: 6 }]}>{pedido.producto}</Text>
        <Text style={[s.small, { marginTop: 2 }]}>{pedido.unidad_medida} · {pedido.participantes} comercios</Text>

        <View style={[s.row, { marginTop: 16, alignItems: "flex-end" }]}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 24, color: colors.ink }}>{soles(pedido.precio_meta)}</Text>
            {ahorro > 0 && <Text style={[s.small, { textDecorationLine: "line-through" }]}>{soles(pedido.precio_lista)}</Text>}
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.brand }}>{pedido.progreso}% de la meta</Text>
        </View>
        <View style={{ marginTop: 10 }}><Progress value={pedido.progreso} /></View>
        {pedido.siguiente_tramo && (
          <Text style={[s.small, { marginTop: 8 }]}>
            Faltan {pedido.siguiente_tramo.faltan} para llegar al {pedido.siguiente_tramo.porcentaje}% de descuento
          </Text>
        )}

        <View style={[s.row, { marginTop: 16 }]}>
          <AvatarStack names={pedido.nombres} total={pedido.participantes} />
          <Button title={yaParticipo ? "Ver mi parte" : "Unirme"} icon="chevron-right" small onPress={onPress}
            variant={yaParticipo ? "secondary" : "primary"} />
        </View>
      </View>
    </Card>
  );
}
