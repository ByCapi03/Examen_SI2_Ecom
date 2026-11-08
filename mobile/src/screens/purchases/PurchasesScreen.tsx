import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/api';
import { PurchaseSummary, RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, any>;

export const PurchasesScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchases = async () => {
    try {
      setError(null);
      const { data } = await api.get<PurchaseSummary[]>('/sales/my');
      setPurchases(data);
    } catch (err: any) {
      console.error('Error fetching purchases:', err);
      setError('No se pudieron cargar tus compras.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchPurchases();
    }
  }, [isFocused]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPurchases();
  };

  const renderItem = ({ item }: { item: PurchaseSummary }) => {
    const formattedTotal = Number(item.total).toFixed(2);
    const dateFormatted = new Date(item.date).toLocaleDateString();

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('PurchaseDetail', { purchaseId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Compra #{item.id}</Text>
          <View style={styles.channelBadge}>
            <Text style={styles.channelBadgeText}>{item.channel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardText}>
            <Text style={styles.bold}>Sucursal:</Text> {item.branchName}
          </Text>
          <Text style={styles.cardText}>
            <Text style={styles.bold}>Fecha:</Text> {dateFormatted}
          </Text>
          <Text style={styles.cardText}>
            <Text style={styles.bold}>Estado:</Text> {item.status}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.itemCount}>
              {item.itemsCount} {item.itemsCount === 1 ? 'producto' : 'productos'}
            </Text>
            <Text style={styles.totalText}>Bs. {formattedTotal}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando tus compras...</Text>
      </View>
    );
  }

  if (error && !refreshing && purchases.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <Pressable style={styles.exploreButton} onPress={fetchPurchases}>
          <Text style={styles.exploreButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (purchases.length === 0 && !error) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Aún no tienes compras registradas.</Text>
        <Text style={styles.emptySubtext}>
          Tus compras en tiendas físicas y futuras compras en línea aparecerán aquí.
        </Text>
        <Pressable
          style={styles.exploreButton}
          onPress={() => navigation.navigate('CatalogTab' as any)}
        >
          <Text style={styles.exploreButtonText}>Explorar catálogo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={purchases}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.primary,
  },
  channelBadge: {
    backgroundColor: '#e2e3e5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  channelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#383d41',
  },
  cardBody: {
    gap: 4,
  },
  cardText: {
    ...typography.body,
    color: colors.text,
  },
  bold: {
    fontWeight: '600',
    color: colors.primaryDark,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemCount: {
    ...typography.body,
    color: colors.muted,
  },
  totalText: {
    ...typography.h3,
    color: colors.gold,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.cream,
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.muted,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    margin: spacing.lg,
    borderRadius: radius.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: 40,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  exploreButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  exploreButtonText: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
});
