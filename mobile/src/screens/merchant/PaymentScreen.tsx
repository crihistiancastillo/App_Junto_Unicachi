import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { api } from "../../api/client";
import { culqiActivo, tokenTarjeta, tokenYape } from "../../api/culqi";
import { Button, Card, Chips, Field, PageTitle, s, Screen } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { colors, soles } from "../../theme";

type Metodo = "YAPE" | "TARJETA";

/** Pagar su parte del pedido: tokeniza con Culqi y la API realiza el cargo. */
export function PaymentScreen() {
  const nav = useNavigation<any>();
  const { participacionId, monto, codigo } = useRoute<any>().params;
  const { usuario } = useAuth();
  const [metodo, setMetodo] = useState<Metodo>("YAPE");
  const [celular, setCelular] = useState("");
  const [otp, setOtp] = useState("");
  const [tarjeta, setTarjeta] = useState({ numero: "", mes: "", anio: "", cvv: "" });
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido = metodo === "YAPE"
    ? /^9\d{8}$/.test(celular) && /^\d{6}$/.test(otp)
    : tarjeta.numero.replace(/\s/g, "").length >= 15 && /^\d{2}$/.test(tarjeta.mes) && /^\d{2,4}$/.test(tarjeta.anio) && /^\d{3,4}$/.test(tarjeta.cvv);

  const pagar = async () => {
    setPagando(true);
    setError(null);
    try {
      const token = metodo === "YAPE"
        ? await tokenYape({ celular, otp, montoSoles: monto })
        : await tokenTarjeta({ ...tarjeta, email: usuario!.email });
      const r = await api<{ pago: { estado: string }; mensaje: string }>(`/participaciones/${participacionId}/pagar`, {
        body: { metodo, token },
      });
      if (r.pago.estado !== "APROBADO") throw new Error(r.mensaje);
      Alert.alert("Pago confirmado", `Pagaste ${soles(monto)} del pedido ${codigo}.`, [{ text: "Ver pedido", onPress: () => nav.goBack() }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPagando(false);
    }
  };

  return (
    <Screen>
      <PageTitle eyebrow={`Pedido ${codigo}`} title={`Paga ${soles(monto)}`} subtitle="Tu pago confirma tu parte. Si el pedido no se entrega, te devolvemos el dinero." />
      <Chips<Metodo> value={metodo} onChange={setMetodo} options={[{ value: "YAPE", label: "Yape" }, { value: "TARJETA", label: "Tarjeta" }]} />

      <Card style={{ marginTop: 18 }}>
        {metodo === "YAPE" ? (
          <>
            <Field label="Celular registrado en Yape" keyboardType="phone-pad" maxLength={9} value={celular} onChangeText={setCelular} placeholder="987654321" />
            <Field label="Código de aprobación" hint="Lo encuentras en tu app Yape, en el menú «Código de aprobación»."
              keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} placeholder="6 dígitos" />
          </>
        ) : (
          <>
            <Field label="Número de tarjeta" keyboardType="number-pad" maxLength={19} value={tarjeta.numero}
              onChangeText={(numero) => setTarjeta({ ...tarjeta, numero })} placeholder="4111 1111 1111 1111" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Mes" keyboardType="number-pad" maxLength={2} value={tarjeta.mes} onChangeText={(mes) => setTarjeta({ ...tarjeta, mes })} placeholder="MM" /></View>
              <View style={{ flex: 1 }}><Field label="Año" keyboardType="number-pad" maxLength={4} value={tarjeta.anio} onChangeText={(anio) => setTarjeta({ ...tarjeta, anio })} placeholder="AA" /></View>
              <View style={{ flex: 1 }}><Field label="CVV" keyboardType="number-pad" maxLength={4} secureTextEntry value={tarjeta.cvv} onChangeText={(cvv) => setTarjeta({ ...tarjeta, cvv })} placeholder="123" /></View>
            </View>
          </>
        )}
        {error && <Text style={[s.small, { color: colors.danger, marginBottom: 10 }]}>{error}</Text>}
        <Button title={`Pagar ${soles(monto)}`} icon="lock" loading={pagando} disabled={!valido} onPress={pagar} />
      </Card>
      <Text style={[s.small, { marginTop: 14, textAlign: "center" }]}>
        {culqiActivo ? "Pago procesado de forma segura por Culqi. Junto no guarda los datos de tu tarjeta." : "Modo demo: el pago es simulado. Una tarjeta terminada en 0002 simula un rechazo."}
      </Text>
    </Screen>
  );
}
