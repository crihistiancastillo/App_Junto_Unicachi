import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { api, useApi } from "../api/client";
import type { Notificacion } from "../api/types";
import { Empty, Icon, Loading, PageTitle, s, Screen, type IconName } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

const ICONOS: Record<string, IconName> = { PEDIDO: "users", PAGO: "credit-card", ENTREGA: "truck", OFERTA: "tag" };

export function NotificationsScreen() {
  const nav = useNavigation<any>();
  const { usuario } = useAuth();
  const { data, loading, reload } = useApi<Notificacion[]>("/notificaciones");
  useEffect(() => () => { api("/notificaciones/leer-todas", { method: "POST" }).catch(() => {}); }, []);

  const abrir = (n: Notificacion) => {
    if (!n.referencia) return;
    if (usuario?.rol === "COMERCIANTE") nav.navigate("DetallePedido", { id: n.referencia });
    if (usuario?.rol === "MAYORISTA" && n.tipo === "OFERTA") nav.navigate("DetalleConsolidado", { id: n.referencia });
  };

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle title="Notificaciones" />
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty icon="bell" title="Estás al día" text="Te avisaremos cuando tus pedidos avancen." />}
      {data?.map((n) => (
        <Pressable key={n.id} onPress={() => abrir(n)}
          style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={[s.iconTile, !n.leida && { backgroundColor: colors.amberSoft }]}>
            <Icon name={ICONOS[n.tipo] ?? "bell"} size={18} color={n.leida ? colors.brand : colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.strong}>{n.titulo}</Text>
            <Text style={s.small}>{n.mensaje}</Text>
            <Text style={[s.small, { marginTop: 4, fontSize: 11 }]}>{new Date(n.fecha_envio).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
