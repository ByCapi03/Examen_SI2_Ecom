import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

import { ClientDrawer } from './ClientTabs';
import { ProductDetailScreen } from '../screens/store/ProductDetailScreen';
import { ReservationDetailScreen } from '../screens/reservations/ReservationDetailScreen';
import { PurchaseDetailScreen } from '../screens/purchases/PurchaseDetailScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ActivateAccountScreen } from '../screens/auth/ActivateAccountScreen';
import { CreateReservationScreen } from '../screens/store/CreateReservationScreen';
import { CheckoutScreen } from '../screens/store/CheckoutScreen';
import { TryOnScreen } from '../screens/store/TryOnScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#1a1a1a',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={ClientDrawer}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Detalle de Producto' }}
      />

      <Stack.Screen
        name="CreateReservation"
        component={CreateReservationScreen}
        options={{ title: 'Confirmar Reserva' }}
      />

      <Stack.Screen
        name="ReservationDetail"
        component={ReservationDetailScreen}
        options={{ title: 'Detalle de Reserva' }}
      />

      <Stack.Screen
        name="PurchaseDetail"
        component={PurchaseDetailScreen}
        options={{ title: 'Detalle de Compra' }}
      />

      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Checkout' }}
      />

      <Stack.Screen
        name="TryOn"
        component={TryOnScreen}
        options={{ title: 'Vestidor Virtual', headerShown: false }}
      />

      {!isAuthenticated && (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Iniciar Sesión' }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Crear Cuenta' }}
          />
          <Stack.Screen
            name="ActivateAccount"
            component={ActivateAccountScreen}
            options={{ title: 'Activar Cuenta' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
