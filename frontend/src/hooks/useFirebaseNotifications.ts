import { useState } from 'react';
import { api } from '../api/axios';
import { messaging, getToken } from '../config/firebase';

export const useFirebaseNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const checkSupport = () => {
    return 'Notification' in window && 'serviceWorker' in navigator;
  };

  const requestPermissionAndRegister = async () => {
    if (!checkSupport()) {
      console.warn('Este navegador no soporta notificaciones o service workers.');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === 'granted') {
        // En lugar de registrar un service worker duplicado que colisione con el scope de la PWA,
        // usamos el Service Worker unificado activo de la aplicación
        const registration = await navigator.serviceWorker.ready;
        
        const token = await getToken(messaging, { 
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          await api.post('/notifications/devices', {
            token,
            platform: 'WEB'
          });
          console.log('Firebase token registered successfully with unified Service Worker');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      return false;
    }
  };

  return {
    isSupported: checkSupport(),
    permission,
    requestPermissionAndRegister
  };
};
