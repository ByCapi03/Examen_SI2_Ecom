import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/api';
import { colors } from '../theme/theme';
import { notificationEvents } from '../notifications/notificationEvents';

/** Campanita del encabezado: muestra cuántas notificaciones sin leer hay y abre la lista. */
export const NotificationBell: React.FC = () => {
  const navigation = useNavigation<any>();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ read: boolean }[]>('/notifications/my');
      setUnread(data.filter((n) => !n.read).length);
    } catch {
      /* sin red: se conserva el último número */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    const unsub = notificationEvents.subscribe(() => { void refresh(); });
    return () => { clearInterval(timer); sub.remove(); unsub(); };
  }, [refresh]);

  return (
    <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.button} hitSlop={10} accessibilityLabel="Notificaciones">
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.primary} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { marginRight: 16, padding: 4 },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
