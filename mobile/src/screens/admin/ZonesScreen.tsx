import { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { api, useApi } from "../../api/client";
import { Button, Card, Field, Loading, PageTitle, s, Screen } from "../../components/ui";
import { colors } from "../../theme";

type Zona = { id: string; nombre: string; distrito: string; latitud: number; longitud: number; miembros: number; pedidos_activos: number; activa: boolean };

/** Gestionar zonas. */
export function ZonesScreen() {
  const { data, loading, reload } = useApi<Zona[]>("/zonas");
  const [nueva, setNueva] = useState({ nombre: "", distrito: "", latitud: "", longitud: "" });
  const [guardando, setGuardando] = useState(false);
  const valida = nueva.nombre.length > 2 && nueva.distrito.length > 2 && !isNaN(parseFloat(nueva.latitud)) && !isNaN(parseFloat(nueva.longitud));

  const crear = async () => {
    setGuardando(true);
    try {
      await api("/admin/zonas", { body: { nombre: nueva.nombre, distrito: nueva.distrito, latitud: parseFloat(nueva.latitud), longitud: parseFloat(nueva.longitud) } });
      setNueva({ nombre: "", distrito: "", latitud: "", longitud: "" });
      reload();
    } catch (e) {
      Alert.alert("No se pudo crear la zona", (e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Administración" title="Zonas" subtitle="Cada zona agrupa a los comercios que pueden comprar juntos." />
      {loading && !data && <Loading />}
      {data?.map((z) => (
        <Card key={z.id} style={{ marginBottom: 10 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.strong}>{z.nombre}</Text>
              <Text style={s.small}>{z.distrito} · {z.miembros} comercios · {z.pedidos_activos} pedidos abiertos</Text>
            </View>
            <Switch value={z.activa} onValueChange={async (activa) => { await api(`/admin/zonas/${z.id}`, { method: "PATCH", body: { activa } }); reload(); }}
              trackColor={{ true: colors.brand }} />
          </View>
        </Card>
      ))}
      <Text style={[s.h3, { marginTop: 20, marginBottom: 10 }]}>Nueva zona</Text>
      <Card>
        <Field label="Nombre" value={nueva.nombre} onChangeText={(nombre) => setNueva({ ...nueva, nombre })} placeholder="Mercado Santa Rosa" />
        <Field label="Distrito" value={nueva.distrito} onChangeText={(distrito) => setNueva({ ...nueva, distrito })} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Latitud" keyboardType="numbers-and-punctuation" value={nueva.latitud} onChangeText={(latitud) => setNueva({ ...nueva, latitud })} placeholder="-12.0464" /></View>
          <View style={{ flex: 1 }}><Field label="Longitud" keyboardType="numbers-and-punctuation" value={nueva.longitud} onChangeText={(longitud) => setNueva({ ...nueva, longitud })} placeholder="-77.0428" /></View>
        </View>
        <Button title="Crear zona" icon="plus" disabled={!valida} loading={guardando} onPress={crear} />
      </Card>
    </Screen>
  );
}
