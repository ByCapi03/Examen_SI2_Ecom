import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { ClientDrawerParamList } from '../types';
import { colors, typography, spacing } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

import { HomeScreen } from '../screens/store/HomeScreen';
import { CatalogScreen } from '../screens/store/CatalogScreen';
import { ReservationsScreen } from '../screens/reservations/ReservationsScreen';
import { PurchasesScreen } from '../screens/purchases/PurchasesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CartScreen } from '../screens/store/CartScreen';

const Drawer = createDrawerNavigator<ClientDrawerParamList>();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        {/* Drawer Header */}
        <View style={styles.drawerHeader}>
          <Text style={styles.headerTitle}>ATEMPORAL</Text>
          {user && (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          )}
        </View>
        
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Logout Button */}
      {user && (
        <View style={styles.logoutContainer}>
          <View style={styles.separator} />
          <Pressable 
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && { opacity: 0.7 }
            ]}
            onPress={logout}
          >
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export const ClientDrawer = () => {
  const { cart } = useCart();
  
  const cartItemsCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <Drawer.Navigator
      initialRouteName="HomeTab"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.primary,
        headerTitleStyle: { ...typography.h3, color: colors.primary },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        drawerActiveBackgroundColor: colors.gold + '20', // gold with opacity
        drawerActiveTintColor: colors.primaryDark,
        drawerInactiveTintColor: colors.primary,
        drawerLabelStyle: {
          ...typography.subtitle,
          marginLeft: -10,
        },
        drawerStyle: {
          backgroundColor: colors.cream,
        },
      }}
    >
      <Drawer.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          drawerLabel: '🏠 Inicio',
          title: 'ATEMPORAL',
        }}
      />
      <Drawer.Screen
        name="CatalogTab"
        component={CatalogScreen}
        options={{
          drawerLabel: '👗 Catálogo',
          title: 'ATEMPORAL',
        }}
      />
      <Drawer.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          drawerLabel: `🛒 Carrito${cartItemsCount > 0 ? `   ${cartItemsCount}` : ''}`,
          title: 'ATEMPORAL',
        }}
      />
      <Drawer.Screen
        name="ReservationsTab"
        component={ReservationsScreen}
        options={{
          drawerLabel: '📅 Mis Reservas',
          title: 'ATEMPORAL',
        }}
      />
      <Drawer.Screen
        name="PurchasesTab"
        component={PurchasesScreen}
        options={{
          drawerLabel: '🧾 Mis Compras',
          title: 'ATEMPORAL',
        }}
      />
      <Drawer.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          drawerLabel: '👤 Perfil',
          title: 'ATEMPORAL',
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerHeader: {
    padding: spacing.xl,
    paddingTop: spacing.xxl + 20, // To account for status bar
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  userInfo: {
    marginTop: spacing.sm,
  },
  userName: {
    ...typography.subtitle,
    color: colors.cream,
  },
  userEmail: {
    ...typography.caption,
    color: colors.cream,
    opacity: 0.8,
  },
  logoutContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  logoutButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  logoutText: {
    ...typography.subtitle,
    color: '#d32f2f', // red for logout
    fontWeight: '600',
  },
});
