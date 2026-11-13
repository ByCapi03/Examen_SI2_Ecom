import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { setAccessHandler } from './src/api/api';
import { CartProvider } from './src/context/CartContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useAutoSync } from './src/sync/useOfflineSync';
import { navigationRef } from './src/navigation/navigationRef';

/** Registra el dispositivo para push solo cuando hay sesión (el token se guarda por usuario). */
function PushRegistrar() {
  const { isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);
  return null;
}

/** Mensajes cuando la empresa del cliente está suspendida o su suscripción venció. */
function AccessWatcher() {
  const { logout } = useAuth();
  React.useEffect(() => {
    let shown = false;
    setAccessHandler((kind) => {
      if (shown) return;
      shown = true;
      if (kind === 'SUSPENDED') {
        Alert.alert(
          'Tienda no disponible',
          'Esta tienda no está disponible por el momento. Vuelve a intentarlo más tarde o contacta directamente al negocio.',
          [{ text: 'Cerrar sesión', onPress: () => { shown = false; void logout(); } }],
          { cancelable: false },
        );
      } else {
        Alert.alert(
          'Servicio no disponible',
          'La tienda no puede procesar esta operación por ahora. Intenta más tarde o contacta al negocio.',
          [{ text: 'Entendido', onPress: () => { shown = false; } }],
        );
      }
    });
    return () => setAccessHandler(null);
  }, [logout]);
  return null;
}

export default function App() {
  useAutoSync();

  return (
    <SafeAreaProvider>
      <StripeProvider 
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'}
        merchantIdentifier=""
      >
        <AuthProvider>
          <CartProvider>
            <PushRegistrar />
            <AccessWatcher />
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </CartProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
