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
import { ReservationSummary, RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, any>;

export const ReservationsScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = async () => {
    try {
      setError(null);
      const { data } = await api.get<ReservationSummary[]>('/reservations/my');
      setReservations(data);
    } catch (err: any) {
      console.error('Error fetching reservations:', err);
      setError('No se pudieron cargar tus reservas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchReservations();
    }
  }, [isFocused]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReservations();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
      case 'CONFIRMADA':
      case 'PREPARANDO':
      case 'LISTA':
        return { bg: '#fff3cd', text: '#664d03' };
      case 'ATENDIDA':
        return { bg: '#d1e7dd', text: '#0f5132' };
      case 'CANCELADA':
        return { bg: '#f8d7da', text: colors.danger };
      default:
        return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  const renderItem = ({ item }: { item: ReservationSummary }) => {
    const statusStyle = getStatusColor(item.status);
    const itemsCount = item.items ? item.items.length : 0;

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('ReservationDetail', { reservationId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Reserva #{item.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardText}>
            <Text style={styles.bold}>Sucursal:</Text> {item.branch?.name}
          </Text>
          <Text style={styles.cardText}>
            <Text style={styles.bold}>Fecha recojo:</Text> {item.date}
          </Text>
          {item.approximateTime && (
            <Text style={styles.cardText}>
              <Text style={styles.bold}>Hora aprox:</Text> {item.approximateTime}
            </Text>
          )}
          <Text style={styles.cardSubtext}>
            {itemsCount} {itemsCount === 1 ? 'producto reservado' : 'productos reservados'}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando tus reservas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Aún no tienes reservas.</Text>
            <Text style={styles.emptySubtext}>
              Explora el catálogo y reserva tus prendas favoritas para recogerlas en tienda.
            </Text>
            <Pressable
              style={styles.exploreButton}
              onPress={() => navigation.navigate('CatalogTab' as any)}
            >
              <Text style={styles.exploreButtonText}>Explorar catálogo</Text>
            </Pressable>
          </View>
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  cardSubtext: {
    ...typography.body,
    color: colors.gold,
    fontWeight: '600',
    marginTop: spacing.xs,
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
