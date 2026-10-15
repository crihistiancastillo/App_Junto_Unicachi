import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./api/client";

/** Expo Go ya no soporta push remotas en Android: ahí solo se usa la bandeja de la app. */
const enExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Pide permiso y registra el token nativo de FCM en la API, que lo usa con
 * firebase-admin para enviar los push. expo-notifications se carga de forma
 * diferida para que su ausencia en Expo Go no rompa la app al iniciar.
 */
export async function registrarDispositivo() {
  if (!Device.isDevice || enExpoGo) return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true,
      }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Pedidos y entregas",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#136a50",
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const { data } = await Notifications.getDevicePushTokenAsync();
    await api("/me/dispositivos", { body: { fcm_token: String(data), plataforma: Platform.OS } });
  } catch (e) {
    console.warn("No se pudo registrar el dispositivo:", (e as Error).message);
  }
}
