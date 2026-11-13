import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import type * as NotificationsType from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/api';
import { notificationEvents } from '../notifications/notificationEvents';
import { navigationRef } from '../navigation/navigationRef';

/** Canal de Android con sonido. Un canal ya creado no se puede modificar, por eso tiene un id nuevo. */
export const ALERT_CHANNEL = 'alertas';

// Expo Go (SDK 53+) ya no soporta notificaciones push: se omiten ahí y funcionan en una compilación propia.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications: typeof NotificationsType = IS_EXPO_GO ? (null as any) : require('expo-notifications');

if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** `enabled` = hay sesión iniciada: el token solo se puede guardar en el servidor con un usuario autenticado. */
export function usePushNotifications(enabled: boolean = true) {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<NotificationsType.Notification | false>(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!enabled || IS_EXPO_GO) return;
    registerForPushNotificationsAsync().then(result => {
      if (result && result.token) {
        setExpoPushToken(result.token);
        console.log({
          expoPushToken: result.token,
          permissionStatus: result.status
        });
        // Send token to backend
        api.post('/notifications/devices', {
          token: result.token,
          platform: Platform.OS,
        }).catch(err => console.log('Failed to save push token', err));
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      notificationEvents.emit();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // Al tocar el aviso: la reserva del cliente se abre directo; el resto va a la lista de notificaciones.
      const data: any = response.notification.request.content.data ?? {};
      if (!navigationRef.isReady()) return;
      if (data.reservationId && data.route === '/reservations') {
        navigationRef.navigate('ReservationDetail', { reservationId: Number(data.reservationId) });
      } else {
        navigationRef.navigate('Notifications');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [enabled]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
      name: 'Alertas de la tienda',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C9904A',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return { token: undefined, status: finalStatus };
    }
    try {
      if (Platform.OS === 'android') {
        // Token FCM nativo: lo envía el backend con Firebase (usa google-services.json), sin depender de EAS.
        token = (await Notifications.getDevicePushTokenAsync()).data;
      } else {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
      console.log(token);
    } catch (e) {
      console.log(e);
    }
    return { token, status: finalStatus };
  } else {
    console.log('Must use physical device for Push Notifications');
    return { token: undefined, status: 'undetermined' };
  }
}
