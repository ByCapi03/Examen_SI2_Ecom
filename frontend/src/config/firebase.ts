import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyB52zwwfpkRUkhaQoacF62xCeE_R2mB2pY",
  authDomain: "atemporal-f0125.firebaseapp.com",
  projectId: "atemporal-f0125",
  storageBucket: "atemporal-f0125.firebasestorage.app",
  messagingSenderId: "314117413244",
  appId: "1:314117413244:web:47cfea19f16e77ef35acf9",
  measurementId: "G-XSCZM6W9KY"
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

export { messaging, getToken, onMessage, firebaseConfig };
