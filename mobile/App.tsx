import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { Navigation } from "./src/navigation";

export default function App() {
  // Mismas tipografías del prototipo de Figma Make: DM Sans (texto) y Manrope (títulos).
  // Si las fuentes fallan, la app sigue con la tipografía del sistema en vez de quedarse en blanco.
  const [listo, error] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!listo && !error) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
