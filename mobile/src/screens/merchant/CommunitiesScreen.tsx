import { Text, View } from "react-native";
import { useApi } from "../../api/client";
import { AvatarStack, Card, ErrorBox, Icon, Loading, PageTitle, Pill, s, Screen } from "../../components/ui";
import { colors } from "../../theme";

type Zona = { id: string; nombre: string; distrito: string; miembros: number; pedidos_activos: number; nombres: string[] | null; es_mia: boolean };

/** "Comunidades" del prototipo = zonas del modelo de datos. */
export function CommunitiesScreen() {
  const { data, error, loading, reload } = useApi<Zona[]>("/zonas");
  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <PageTitle eyebrow="Red local" title="Comunidades" subtitle="Los pedidos se arman con comercios de tu misma zona." />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data?.map((z) => (
        <Card key={z.id} style={{ marginBottom: 14 }}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View style={[s.iconTile, { width: 48, height: 48, borderRadius: 16 }, !z.es_mia && { backgroundColor: colors.amberSoft }]}>
              <Icon name="users" color={z.es_mia ? colors.brand : colors.amber} />
            </View>
            {z.es_mia ? <Pill>Tu comunidad</Pill> : <Text style={s.small}>{z.distrito}</Text>}
          </View>
          <Text style={[s.h3, { marginTop: 14 }]}>{z.nombre}</Text>
          <Text style={s.small}>{z.miembros} miembros · {z.pedidos_activos} pedidos activos</Text>
          <View style={[s.divider, { marginBottom: 12 }]} />
          <AvatarStack names={z.nombres ?? []} total={z.miembros} />
        </Card>
      ))}
    </Screen>
  );
}
