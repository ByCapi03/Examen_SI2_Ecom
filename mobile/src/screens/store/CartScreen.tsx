import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert } from 'react-native';
import { useCart } from '../../context/CartContext';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';

export const CartScreen: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, totalItems } = useCart();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleClear = () => {
    Alert.alert(
      'Vaciar Carrito',
      '¿Estás seguro de que deseas eliminar todos los productos del carrito?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Vaciar', style: 'destructive', onPress: clearCart }
      ]
    );
  };

  if (cart.items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Tu carrito está vacío</Text>
      </View>
    );
  }

  const subtotalCart = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Mi Carrito</Text>
            {cart.branchName && (
              <Text style={styles.branchText}>Sucursal: {cart.branchName}</Text>
            )}
          </View>
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Vaciar</Text>
          </Pressable>
        </View>

        {cart.items.map(item => (
          <View key={item.variantId} style={styles.cartItem}>
            <View style={styles.itemImageContainer}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              ) : (
                <View style={styles.placeholderImage} />
              )}
            </View>
            
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemVariants}>{item.size} | {item.color}</Text>
              
              <View style={styles.priceRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.itemPrice}>Bs. {Number(item.price).toFixed(2)}</Text>
                  {item.basePrice && item.basePrice > item.price && (
                    <Text style={{ fontSize: 11, textDecorationLine: 'line-through', color: '#999' }}>
                      Bs. {Number(item.basePrice).toFixed(2)}
                    </Text>
                  )}
                </View>
                <Text style={styles.subtotalText}>Subtotal: Bs. {(item.price * item.quantity).toFixed(2)}</Text>
              </View>

              <View style={styles.actionsRow}>
                <View style={styles.quantityContainer}>
                  <Pressable 
                    style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnDisabled]}
                    onPress={() => updateQuantity(item.variantId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <Pressable 
                    style={[styles.qtyBtn, item.quantity >= item.available && styles.qtyBtnDisabled]}
                    onPress={() => updateQuantity(item.variantId, item.quantity + 1)}
                    disabled={item.quantity >= item.available}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                </View>

                <Pressable onPress={() => removeFromCart(item.variantId)}>
                  <Text style={styles.deleteText}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.totalLabel}>Total ({totalItems} items):</Text>
          <Text style={styles.totalAmount}>Bs. {subtotalCart.toFixed(2)}</Text>
        </View>
        <Pressable 
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate('Checkout')}
        >
          <Text style={styles.checkoutBtnText}>Proceder al Pago</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.h3,
    color: colors.muted,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
  },
  branchText: {
    ...typography.caption,
    color: colors.gold,
    marginTop: 2,
  },
  clearBtn: {
    padding: spacing.sm,
  },
  clearBtnText: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginRight: spacing.md,
    backgroundColor: '#f5f5f5',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    ...typography.subtitle,
    color: colors.primaryDark,
  },
  itemVariants: {
    ...typography.caption,
    color: colors.muted,
    marginVertical: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  itemPrice: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  subtotalText: {
    ...typography.caption,
    fontWeight: 'bold',
    color: colors.gold,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  qtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#f8f8f8',
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  qtyText: {
    paddingHorizontal: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: {
    ...typography.subtitle,
    color: colors.primaryDark,
  },
  totalAmount: {
    ...typography.h3,
    color: colors.gold,
  },
  checkoutBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: colors.cream,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
