import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useAutoSync } from './src/sync/useOfflineSync';

/** Registra el dispositivo para push solo cuando hay sesión (el token se guarda por usuario). */
function PushRegistrar() {
  const { isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);
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
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </CartProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
