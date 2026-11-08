import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/api';
import { PurchaseDetail, RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseDetail'>;

export const PurchaseDetailScreen: React.FC<Props> = ({ route }) => {
  const { purchaseId } = route.params;

  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get<PurchaseDetail>(`/sales/my/${purchaseId}`);
        setPurchase(data);
      } catch (err: any) {
        console.error('Error fetching purchase detail:', err);
        setError(err.response?.data?.message || 'Compra no encontrada');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [purchaseId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0056b3" />
        <Text style={styles.loadingText}>Cargando detalle de compra...</Text>
      </View>
    );
  }

  if (error || !purchase) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Compra no encontrada'}</Text>
      </View>
    );
  }

  const formattedTotal = Number(purchase.total).toFixed(2);
  const formattedSubtotal = Number(purchase.subtotal).toFixed(2);
  const formattedDiscount = Number(purchase.discount || 0).toFixed(2);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Compra #{purchase.id}</Text>
          <View style={styles.channelBadge}>
            <Text style={styles.channelBadgeText}>{purchase.channel}</Text>
          </View>
        </View>

        <View style={styles.metaList}>
          <Text style={styles.metaItem}>
            <Text style={styles.bold}>Sucursal:</Text> {purchase.branchName}
          </Text>
          <Text style={styles.metaItem}>
            <Text style={styles.bold}>Fecha:</Text> {new Date(purchase.date).toLocaleString()}
          </Text>
          <Text style={styles.metaItem}>
            <Text style={styles.bold}>Estado:</Text> {purchase.status}
          </Text>
        </View>
      </View>

      {/* Items Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Productos Adquiridos</Text>

        {purchase.items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemImageContainer}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Text style={{ fontSize: 10, color: '#aaa' }}>Sin imagen</Text>
                </View>
              )}
            </View>

            <View style={styles.itemInfo}>
              <Text style={styles.productName}>{item.productName}</Text>
              <Text style={styles.variantDetails}>
                Talla: {item.sizeName} | Color: {item.colorName}
              </Text>
              <Text style={styles.itemPricing}>
                {item.quantity} u. x Bs. {Number(item.unitPrice).toFixed(2)}
              </Text>
            </View>

            <Text style={styles.itemSubtotal}>
              Bs. {Number(item.subtotal).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Payment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Forma de Pago</Text>
        {purchase.payments.map((p) => (
          <View key={p.id} style={styles.paymentCard}>
            <Text style={styles.paymentMethod}>
              Método: <Text style={styles.bold}>{p.method}</Text> ({p.status})
            </Text>
            <Text style={styles.paymentAmount}>
              Bs. {Number(p.amount).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Totals Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>Bs. {formattedSubtotal}</Text>
        </View>

        {Number(purchase.discount) > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Descuento</Text>
            <Text style={[styles.summaryValue, { color: '#198754' }]}>
              - Bs. {formattedDiscount}
            </Text>
          </View>
        )}

        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Bs. {formattedTotal}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 16,
    textAlign: 'center',
  },
  headerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  channelBadge: {
    backgroundColor: '#e2e3e5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  channelBadgeText: {
    color: '#383d41',
    fontSize: 12,
    fontWeight: '700',
  },
  metaList: {
    gap: 6,
  },
  metaItem: {
    fontSize: 14,
    color: '#444',
  },
  bold: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  itemImageContainer: {
    width: 55,
    height: 55,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  variantDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemPricing: {
    fontSize: 12,
    color: '#777',
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#444',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginTop: 10,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0056b3',
  },
});
