import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useAutoSync } from './src/sync/useOfflineSync';

export default function App() {
  usePushNotifications();
  useAutoSync();

  return (
    <SafeAreaProvider>
      <StripeProvider 
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'}
        merchantIdentifier=""
      >
        <AuthProvider>
          <CartProvider>
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
