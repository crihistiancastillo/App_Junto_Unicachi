import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import { Button, Card, Chips, Loading, PageTitle, Pill, s, Screen } from "../../components/ui";

type Filtro = "TODOS" | "COMERCIANTE" | "MAYORISTA";
type Fila = { id: string; nombre: string; email: string; rol: string; estado: string; negocio: string; ruc: string; zona: string | null; es_mype: boolean | null };

/** Gestionar comercios (activar, suspender, verificar mayoristas). */
export function MerchantsScreen() {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const { data, loading, reload } = useApi<Fila[]>(`/admin/comercios${filtro === "TODOS" ? "" : `?rol=${filtro}`}`);

  const cambiar = (u: Fila, estado: "ACTIVA" | "SUSPENDIDA") =>
    Alert.alert(estado === "SUSPENDIDA" ? `¿Suspender a ${u.negocio}?` : `¿Activar a ${u.negocio}?`,
      estado === "SUSPENDIDA" ? "No podrá iniciar sesión ni participar en pedidos." : "Podrá operar en la plataforma.",
      [{ text: "Cancelar", style: "cancel" },
       { text: estado === "SUSPENDIDA" ? "Suspender" : "Activar", onPress: async () => { await api(`/admin/usuarios/${u.id}`, { method: "PATCH", body: { estado } }); reload(); } }]);

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Administración" title="Comercios" />
      <Chips value={filtro} onChange={setFiltro} options={[{ value: "TODOS", label: "Todos" }, { value: "COMERCIANTE", label: "Comerciantes" }, { value: "MAYORISTA", label: "Mayoristas" }]} />
      <View style={{ height: 16 }} />
      {loading && !data && <Loading />}
      {data?.map((u) => (
        <Card key={u.id} style={{ marginBottom: 10 }}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={s.strong}>{u.negocio}</Text>
              <Text style={s.small}>{u.nombre} · RUC {u.ruc}</Text>
              <Text style={s.small}>{u.rol === "MAYORISTA" ? "Mayorista" : `${u.zona}${u.es_mype ? " · MYPE" : ""}`}</Text>
            </View>
            <Pill tone={u.estado === "ACTIVA" ? "green" : u.estado === "SUSPENDIDA" ? "danger" : "amber"}>
              {u.estado === "PENDIENTE_VERIFICACION" ? "Por verificar" : u.estado === "ACTIVA" ? "Activa" : "Suspendida"}
            </Pill>
          </View>
          <Button small style={{ marginTop: 12, alignSelf: "flex-start" }}
            variant={u.estado === "ACTIVA" ? "danger" : "primary"}
            title={u.estado === "ACTIVA" ? "Suspender" : u.estado === "PENDIENTE_VERIFICACION" ? "Verificar y activar" : "Reactivar"}
            onPress={() => cambiar(u, u.estado === "ACTIVA" ? "SUSPENDIDA" : "ACTIVA")} />
        </Card>
      ))}
    </Screen>
  );
}
