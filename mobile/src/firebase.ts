import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigurado = !!config.apiKey;

/** Firebase Auth; null mientras no se configuren las variables EXPO_PUBLIC_FIREBASE_*. */
export const auth = firebaseConfigurado ? getAuth(getApps()[0] ?? initializeApp(config)) : null;
