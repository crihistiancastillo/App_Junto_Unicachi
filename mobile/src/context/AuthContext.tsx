import * as SecureStore from "expo-secure-store";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, DEMO_MODE, setTokenProvider } from "../api/client";
import type { Usuario } from "../api/types";
import { auth, firebaseConfigurado } from "../firebase";
import { registrarDispositivo } from "../notifications";

type AuthState = {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const DEMO_KEY = "junto.demoToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // El cliente HTTP pide el token aquí: demo o Firebase ID token (se renueva solo).
  useEffect(() => {
    setTokenProvider(async () => demoToken ?? (await auth?.currentUser?.getIdToken()) ?? null);
  }, [demoToken]);

  // Restaurar sesión al abrir la app.
  useEffect(() => {
    (async () => {
      try {
        const guardado = DEMO_MODE ? await SecureStore.getItemAsync(DEMO_KEY) : null;
        if (guardado) {
          setDemoToken(guardado);
          setUsuario(await api<Usuario>("/me", { token: guardado }));
        } else if (auth) {
          await auth.authStateReady();
          if (auth.currentUser) setUsuario(await api<Usuario>("/me"));
        }
      } catch {
        await SecureStore.deleteItemAsync(DEMO_KEY);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (usuario) registrarDispositivo();
  }, [usuario?.id]);

  const value = useMemo<AuthState>(() => ({
    usuario,
    cargando,
    async iniciarSesion(email, password) {
      if (firebaseConfigurado && auth) {
        await signInWithEmailAndPassword(auth, email.trim(), password).catch(() => {
          throw new Error("Correo o contraseña incorrectos.");
        });
        setUsuario(await api<Usuario>("/me"));
        return;
      }
      if (!DEMO_MODE) throw new Error("La autenticación no está configurada.");
      const { token, usuario } = await api<{ token: string; usuario: Usuario }>("/auth/demo-login", {
        body: { email: email.trim() },
      });
      await SecureStore.setItemAsync(DEMO_KEY, token);
      setDemoToken(token);
      setUsuario(usuario);
    },
    async cerrarSesion() {
      await SecureStore.deleteItemAsync(DEMO_KEY);
      if (auth?.currentUser) await signOut(auth);
      setDemoToken(null);
      setUsuario(null);
    },
  }), [usuario, cargando]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
