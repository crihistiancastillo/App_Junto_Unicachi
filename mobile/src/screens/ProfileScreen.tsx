import { Alert, Text, View } from "react-native";
import { api, useApi } from "../api/client";
import { Button, Card, Loading, PageTitle, Pill, s, Screen } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, fonts } from "../theme";

type Perfil = {
  nombre: string; email: string; telefono: string; rol: string; ruc: string | null; razon_social: string | null;
  nombre_comercial: string | null; tipo_negocio: string | null; es_mype: boolean | null; direccion: string | null;
  zona: string | null; direccion_almacen: string | null;
};
type Consentimiento = { id: string; finalidad: string; version_politica: string; fecha_aceptacion: string; revocado: boolean };

export function ProfileScreen() {
  const { cerrarSesion } = useAuth();
  const perfil = useApi<Perfil>("/me");
  const consent = useApi<Consentimiento[]>("/me/consentimientos");
  const p = perfil.data;

  const revocar = (c: Consentimiento) => Alert.alert(
    "¿Revocar consentimiento?",
    "Dejaremos de usar tus datos para esta finalidad. Sin él no podrás participar en compras colectivas.",
    [{ text: "Cancelar", style: "cancel" },
     { text: "Revocar", style: "destructive", onPress: async () => { await api(`/me/consentimientos/${c.id}/revocar`, { method: "POST" }); consent.reload(); } }],
  );

  if (!p) return <Screen><Loading /></Screen>;
  const negocio = p.nombre_comercial ?? p.razon_social ?? p.nombre;
  const datos: [string, string | null][] = [
    ["RUC", p.ruc], ["Razón social", p.razon_social], ["Teléfono", p.telefono],
    ["Dirección", p.direccion ?? p.direccion_almacen], ["Comunidad", p.zona],
    ["Tipo", p.tipo_negocio === "PUESTO_MERCADO" ? "Puesto de mercado" : p.tipo_negocio === "BODEGA" ? "Bodega" : null],
  ];

  return (
    <Screen onRefresh={perfil.reload} refreshing={perfil.loading}>
      <PageTitle eyebrow={p.rol === "MAYORISTA" ? "Cuenta comercial" : "Información del negocio"} title={p.rol === "MAYORISTA" ? "Mi empresa" : "Mi negocio"} />
      <Card>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 20, color: colors.brand }}>{negocio.split(" ").map((w) => w[0]).join("").slice(0, 2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>{negocio}</Text>
            <Text style={s.small}>{p.nombre} · {p.email}</Text>
          </View>
        </View>
        {p.es_mype && <View style={{ marginTop: 12 }}><Pill>Registrada como MYPE</Pill></View>}
        <View style={s.divider} />
        {datos.filter(([, v]) => v).map(([k, v]) => (
          <View key={k} style={[s.row, { paddingVertical: 8 }]}>
            <Text style={s.small}>{k}</Text>
            <Text style={[s.body, { flexShrink: 1, textAlign: "right", marginLeft: 16 }]}>{v}</Text>
          </View>
        ))}
      </Card>

      <Text style={[s.h3, { marginTop: 24, marginBottom: 6 }]}>Privacidad de tus datos</Text>
      <Text style={[s.small, { marginBottom: 12 }]}>Ley N.º 29733: puedes revisar y revocar los permisos que nos diste.</Text>
      {consent.data?.map((c) => (
        <Card key={c.id} style={{ marginBottom: 10 }}>
          <Text style={s.strong}>{c.finalidad}</Text>
          <Text style={s.small}>Política {c.version_politica} · aceptada el {new Date(c.fecha_aceptacion).toLocaleDateString("es-PE")}</Text>
          {c.revocado ? <View style={{ marginTop: 10 }}><Pill tone="neutral">Revocado</Pill></View>
            : <Button title="Revocar" variant="danger" small style={{ marginTop: 12, alignSelf: "flex-start" }} onPress={() => revocar(c)} />}
        </Card>
      ))}

      <Button title="Cerrar sesión" icon="log-out" variant="secondary" style={{ marginTop: 24 }} onPress={cerrarSesion} />
    </Screen>
  );
}
