import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Configure su propio proyecto de Firebase con las variables VITE_FIREBASE_* (ver .env.example)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB52zwwfpkRUkhaQoacF62xCeE_R2mB2pY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "atemporal-f0125.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "atemporal-f0125",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "atemporal-f0125.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "314117413244",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:314117413244:web:47cfea19f16e77ef35acf9",
};

const app = initializeApp(firebaseConfig);

let messaging: any = null;

// Initialize messaging only if supported and in a secure context
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  }).catch((err) => {
    console.warn("Firebase Messaging error on init:", err);
  });
} else {
  console.warn("ServiceWorker no está disponible. Firebase Messaging deshabilitado.");
}

/** Messaging listo para usar (espera a comprobar soporte del navegador). Devuelve null si no hay soporte. */
export const getMessagingAsync = () =>
  isSupported().then((ok) => (ok ? getMessaging(app) : null)).catch(() => null);

export { messaging, getToken, onMessage, firebaseConfig };
