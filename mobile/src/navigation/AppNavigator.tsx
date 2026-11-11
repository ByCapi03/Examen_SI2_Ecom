import React from 'react';
import { View, Text, Pressable } from 'react-native';
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
// El vestidor usa librerías nativas de TensorFlow que no existen en Expo Go: se cargan solo al abrirlo,
// así la app inicia normalmente aunque esa pantalla no pueda funcionar en Expo Go.
const TryOnScreen = (props: any) => {
  let Screen: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Screen = require('../screens/store/TryOnScreen').TryOnScreen;
  } catch {
    Screen = null;
  }
  if (!Screen) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Vestidor virtual</Text>
        <Text style={{ textAlign: 'center', color: '#555', marginBottom: 20 }}>
          El vestidor usa la cámara con inteligencia artificial y no está disponible en Expo Go.
          Funciona en la compilación propia de la app y en la versión web.
        </Text>
        <Pressable onPress={() => props.navigation.goBack()} style={{ paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#1a1a1a', borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Volver</Text>
        </Pressable>
      </View>
    );
  }
  return <Screen {...props} />;
};

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
      {isAuthenticated ? (
        <>
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

        </>
      ) : (
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
