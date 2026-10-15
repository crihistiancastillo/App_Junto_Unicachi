import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEMO_MODE } from "../../api/client";
import { Button, Field, Icon, s, type IconName } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts } from "../../theme";

const marketPhoto = "https://images.unsplash.com/photo-1678294077054-76966b0a6dac?auto=format&fit=crop&w=1200&q=85";

type Perfil = "COMERCIANTE" | "MAYORISTA" | "ADMINISTRADOR";
const CUENTAS_DEMO: Record<Perfil, string> = {
  COMERCIANTE: "rosa@gmail.com",
  MAYORISTA: "ventas.distribuidorasol@gmail.com",
  ADMINISTRADOR: "admin@junto.pe",
};
const PERFILES: { id: Perfil; titulo: string; detalle: string; icon: IconName }[] = [
  { id: "COMERCIANTE", titulo: "Comerciante", detalle: "Quiero comprar", icon: "shopping-bag" },
  { id: "MAYORISTA", titulo: "Mayorista", detalle: "Quiero vender", icon: "truck" },
];

export function Logo({ light }: { light?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
        <Icon name="box" color={colors.white} size={22} />
      </View>
      <View>
        <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 21, color: light ? colors.white : colors.ink }}>Junto</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: light ? "rgba(255,255,255,.7)" : colors.muted }}>Mercado colectivo</Text>
      </View>
    </View>
  );
}

export function LoginScreen() {
  const { iniciarSesion } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>("COMERCIANTE");
  const [email, setEmail] = useState(DEMO_MODE ? CUENTAS_DEMO.COMERCIANTE : "");
  const [password, setPassword] = useState(DEMO_MODE ? "junto2026" : "");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const elegirPerfil = (p: Perfil) => {
    setPerfil(p);
    if (DEMO_MODE) setEmail(CUENTAS_DEMO[p]);
  };

  const ingresar = async () => {
    setCargando(true);
    setError(null);
    try {
      await iniciarSesion(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ height: 300, backgroundColor: colors.brandDark }}>
          <Image source={{ uri: marketPhoto }} style={[StyleSheet.absoluteFillObject, { opacity: 0.3 }]} />
          <SafeAreaView edges={["top"]} style={{ flex: 1, padding: 24, justifyContent: "space-between" }}>
            <Logo light />
            <Text style={{ fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 35, color: colors.white }}>
              Conecta tu negocio con el poder de la comunidad.
            </Text>
          </SafeAreaView>
        </View>

        <View style={{ padding: 24, marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.canvas }}>
          <Text style={s.h1}>Ingresa a tu cuenta</Text>
          <Text style={s.subtitle}>Elige tu perfil para acceder a las herramientas de tu negocio.</Text>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
            {PERFILES.map((p) => {
              const activo = perfil === p.id;
              return (
                <Pressable key={p.id} onPress={() => elegirPerfil(p.id)} accessibilityRole="radio" accessibilityState={{ selected: activo }}
                  style={{ flex: 1, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: activo ? colors.brand : colors.line, backgroundColor: activo ? colors.brandTint : colors.white }}>
                  <Icon name={p.icon} color={activo ? colors.brand : colors.muted} />
                  <Text style={[s.strong, { marginTop: 12 }]}>{p.titulo}</Text>
                  <Text style={s.small}>{p.detalle}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 22 }}>
            <Field label="Correo electrónico" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <Field label="Contraseña" secureTextEntry value={password} onChangeText={setPassword} error={error} />
          </View>
          <Button title={`Ingresar como ${perfil === "MAYORISTA" ? "mayorista" : perfil === "ADMINISTRADOR" ? "administrador" : "comerciante"}`}
            icon="arrow-right" loading={cargando} onPress={ingresar} />

          {DEMO_MODE && (
            <Pressable onPress={() => elegirPerfil("ADMINISTRADOR")} style={{ marginTop: 18, alignSelf: "center" }}>
              <Text style={s.textButton}>Entrar al panel de administración</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
