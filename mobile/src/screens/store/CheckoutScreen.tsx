import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStripe } from '@stripe/stripe-react-native';
import { useCart } from '../../context/CartContext';
import { RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { api } from '../../api/api';

export const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { cart, clearCart } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'IDLE' | 'VALIDATING' | 'SUCCESS' | 'TIMEOUT'>('IDLE');

  const subtotalCart = cart.items.reduce((acc, item) => acc + (item.basePrice || item.price) * item.quantity, 0);
  const totalCart = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = subtotalCart - totalCart;

  const handleCheckout = async () => {
    if (!cart.branchId || cart.items.length === 0) {
      Alert.alert('Error', 'El carrito está vacío o no hay sucursal seleccionada.');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        clientPlatform: 'mobile',
        branchId: cart.branchId,
        items: cart.items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
      };

      const res = await api.post('/sales/checkout', payload);
      const { saleId, clientSecret } = res.data;

      if (!clientSecret) {
        throw new Error('No se recibió el clientSecret de Stripe');
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Atemporal',
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          console.log('Payment canceled by user');
          try {
            await api.post(`/sales/${saleId}/cancel-pending`);
          } catch (cancelErr: any) {
            console.error('Error al cancelar la venta:', cancelErr);
            Alert.alert('Aviso', 'Cancelaste el pago, pero hubo un problema liberando la reserva en el servidor. Por favor, verifica en Mis Compras.');
          }
          setLoading(false);
          return;
        }
        throw new Error(presentError.message);
      }

      setValidationStatus('VALIDATING');
      startPolling(saleId);

    } catch (err: any) {
      console.error(err);
      Alert.alert('Error en pago', err.response?.data?.message || err.message || 'Error desconocido');
      setLoading(false);
    }
  };

  const startPolling = (saleId: string) => {
    let intervalId: any;
    let timeoutId: any;
    let isDone = false;

    const checkStatus = async () => {
      if (isDone) return;
      try {
        const saleRes = await api.get(`/sales/my/${saleId}`);
        const sale = saleRes.data;

        const isCompleted = sale.status === 'COMPLETADA';
        const isPaymentApproved = sale.payments && sale.payments.some((p: any) => p.status === 'APROBADO');

        if (isCompleted && isPaymentApproved) {
          isDone = true;
          clearCart();
          setValidationStatus('SUCCESS');
          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    checkStatus(); // Initial check

    intervalId = setInterval(checkStatus, 3000);

    timeoutId = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        clearInterval(intervalId);
        setValidationStatus(prev => prev === 'SUCCESS' ? 'SUCCESS' : 'TIMEOUT');
      }
    }, 20000);
  };

  if (validationStatus === 'VALIDATING') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.validatingTitle}>Validando pago...</Text>
        <Text style={styles.validatingText}>Por favor, espera un momento mientras confirmamos tu transacción.</Text>
      </View>
    );
  }

  if (validationStatus === 'TIMEOUT') {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ fontSize: 60 }}>⏳</Text>
        <Text style={styles.successTitle}>Pago en proceso</Text>
        <Text style={styles.validatingText}>Tu pago está siendo procesado. Puedes revisarlo en Mis Compras.</Text>
        <Pressable 
          style={styles.actionBtn}
          onPress={() => {
            navigation.popToTop();
            (navigation as any).navigate('MainTabs', { screen: 'PurchasesTab' });
          }}
        >
          <Text style={styles.actionBtnText}>Ver Mis Compras</Text>
        </Pressable>
      </View>
    );
  }

  if (validationStatus === 'SUCCESS') {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ fontSize: 60, color: colors.success }}>✓</Text>
        <Text style={styles.successTitle}>Compra realizada correctamente</Text>
        
        <Pressable 
          style={styles.actionBtn}
          onPress={() => {
            navigation.popToTop();
            (navigation as any).navigate('MainTabs', { screen: 'PurchasesTab' });
          }}
        >
          <Text style={styles.actionBtnText}>Ver mi compra</Text>
        </Pressable>

        <Pressable 
          style={[styles.actionBtn, styles.secondaryBtn]}
          onPress={() => {
            navigation.popToTop();
          }}
        >
          <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>Seguir comprando</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Resumen del Pedido</Text>
        <Text style={styles.branchText}>Sucursal: {cart.branchName}</Text>

        <View style={styles.itemsCard}>
          {cart.items.map(item => (
            <View key={item.variantId} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemMeta}>Talla: {item.size} | Color: {item.color}</Text>
                <Text style={styles.itemMeta}>Cant: {item.quantity}</Text>
              </View>
              <View style={styles.itemPricing}>
                <Text style={styles.itemPrice}>Bs. {(item.price * item.quantity).toFixed(2)}</Text>
                {item.basePrice && item.basePrice > item.price && (
                  <Text style={styles.itemBasePrice}>Bs. {(item.basePrice * item.quantity).toFixed(2)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>Bs. {subtotalCart.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Descuento</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>- Bs. {discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>TOTAL</Text>
            <Text style={styles.summaryTotalValue}>Bs. {totalCart.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable 
          style={[styles.checkoutBtn, loading && styles.disabledBtn]}
          onPress={handleCheckout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <Text style={styles.checkoutBtnText}>Pagar con Stripe</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  title: { ...typography.h2, color: colors.primary, marginBottom: 4 },
  branchText: { ...typography.body, color: colors.muted, marginBottom: spacing.lg },
  
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: spacing.sm,
  },
  itemInfo: { flex: 1 },
  itemName: { ...typography.subtitle, color: colors.primaryDark },
  itemMeta: { ...typography.caption, color: colors.muted, marginTop: 2 },
  itemPricing: { alignItems: 'flex-end', justifyContent: 'center' },
  itemPrice: { ...typography.body, fontWeight: 'bold', color: colors.primary },
  itemBasePrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: { ...typography.subtitle, color: colors.primaryDark, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { ...typography.body, color: colors.muted },
  summaryValue: { ...typography.body, color: colors.primaryDark, fontWeight: '500' },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: 8,
  },
  summaryTotalLabel: { ...typography.subtitle, fontWeight: 'bold' },
  summaryTotalValue: { ...typography.h3, color: colors.gold },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoutBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.7 },
  checkoutBtnText: { color: colors.cream, fontWeight: 'bold', fontSize: 16 },

  centerContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  validatingTitle: { ...typography.h2, color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  validatingText: { ...typography.body, color: colors.muted, textAlign: 'center', marginBottom: spacing.xl },
  successTitle: { ...typography.h2, color: colors.primaryDark, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionBtnText: { color: colors.cream, fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  secondaryBtnText: { color: colors.primary },
});
