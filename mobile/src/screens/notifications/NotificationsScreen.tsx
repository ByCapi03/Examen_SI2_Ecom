import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/api';
import { RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { notificationEvents } from '../../notifications/notificationEvents';

interface AppNotification {
  id: number; type: string; title: string; message: string; read: boolean; createdAt: string; reservationId: number | null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems((await api.get<AppNotification[]>('/notifications/my')).data);
    } catch {
      setError('No se pudieron cargar las notificaciones.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      try { await api.patch(`/notifications/${n.id}/read`); notificationEvents.emit(); } catch { /* se reintenta al volver */ }
    }
    if (n.reservationId && n.type.startsWith('RESERVATION')) {
      navigation.navigate('ReservationDetail', { reservationId: n.reservationId });
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try { await api.patch('/notifications/read-all'); notificationEvents.emit(); } catch { void load(); }
  };

  const unread = items.filter((n) => !n.read).length;

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
      data={items}
      keyExtractor={(n) => String(n.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerText}>{unread ? `${unread} sin leer` : 'Todo al día'}</Text>
          {unread ? (
            <Pressable onPress={() => void markAll()}><Text style={styles.link}>Marcar todas como leídas</Text></Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{error ?? 'Todavía no tienes notificaciones.'}</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => void open(item)} style={[styles.card, !item.read && styles.unread]}>
          <View style={styles.row}>
            {!item.read ? <View style={styles.dot} /> : null}
            <Text style={[styles.title, !item.read && { fontWeight: '800' }]}>{item.title}</Text>
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        </Pressable>
      )}
    />
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  headerText: { ...typography.subtitle },
  link: { color: colors.gold, fontWeight: '700' },
  empty: { ...typography.body, textAlign: 'center', marginTop: 40, color: colors.muted },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  title: { ...typography.body, fontWeight: '600', flex: 1 },
  message: { ...typography.body },
  time: { ...typography.caption },
});
