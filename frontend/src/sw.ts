/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any;
  firebase: any;
};

// 1. Limpieza de cachés antiguas y precaching de assets estáticos de la app
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// 1.b Navegación SPA offline: cualquier ruta interna (/dashboard/pos/terminal,
// /reservations/new, ...) se resuelve con el index.html precacheado.
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /\/firebase-messaging-sw\.js$/],
  }));
} catch {
  // En modo desarrollo index.html puede no estar en el precache
}

// 2. Caché para Google Fonts (Hojas de estilo)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// 3. Caché para Google Fonts (Fuentes web WOFF2)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
        maxEntries: 30,
      }),
    ],
  })
);

// 4. Caché para bibliotecas externas CDN (TensorFlow / MediaPipe)
registerRoute(
  ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
  new CacheFirst({
    cacheName: 'jsdelivr-cdn-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
        maxEntries: 20,
      }),
    ],
  })
);

// 5. Caché para imágenes de Cloudinary
registerRoute(
  ({ url }) => url.origin.includes('res.cloudinary.com'),
  new StaleWhileRevalidate({
    cacheName: 'cloudinary-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
        maxEntries: 100,
      }),
    ],
  })
);

// 6. Integración y preservación de Firebase Cloud Messaging en segundo plano
try {
  self.importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
  self.importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB52zwwfpkRUkhaQoacF62xCeE_R2mB2pY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "atemporal-f0125.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "atemporal-f0125",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "atemporal-f0125.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "314117413244",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:314117413244:web:47cfea19f16e77ef35acf9",
  };

  if (self.firebase) {
    if (!self.firebase.apps.length) {
      self.firebase.initializeApp(firebaseConfig);
    }
    const messaging = self.firebase.messaging();

    messaging.onBackgroundMessage((payload: any) => {
      console.log('[sw.ts] Mensaje Firebase en segundo plano recibido:', payload);
      const notificationTitle = payload.notification?.title || 'FASHIONSTORE';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/pwa-192x192.png',
        badge: '/favicon.svg',
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (error) {
  console.warn('[sw.ts] Firebase Messaging en segundo plano no se pudo inicializar:', error);
}

// 7. Manejo del ciclo de vida para actualización instantánea cuando se solicite
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

