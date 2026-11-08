import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useOfflineQueue } from './useOfflineSync';
import { removeOperation } from './syncService';

const LABEL: Record<string, { text: string; color: string }> = {
  PENDIENTE: { text: 'Pendiente', color: '#b45309' },
  ERROR: { text: 'Reintentará', color: '#b45309' },
  SINCRONIZANDO: { text: 'Sincronizando', color: '#1d4ed8' },
  SINCRONIZADA: { text: 'Sincronizada', color: '#15803d' },
  CON_CONFLICTO: { text: 'Con conflicto', color: '#b91c1c' },
  RECHAZADA: { text: 'Rechazada', color: '#b91c1c' },
};

/** Lista de operaciones registradas sin conexión y su estado de sincronización. */
export const PendingSyncBanner: React.FC = () => {
  const { queue, syncing, syncNow } = useOfflineQueue();
  if (!queue.length) return null;
  const pending = queue.filter((q) => q.status === 'PENDIENTE' || q.status === 'ERROR').length;

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>{pending ? `${pending} operación(es) sin sincronizar` : 'Operaciones offline'}</Text>
        <Pressable onPress={() => void syncNow()} disabled={syncing} style={styles.button}>
          <Text style={styles.buttonText}>{syncing ? 'Sincronizando…' : 'Sincronizar'}</Text>
        </Pressable>
      </View>
      {queue.slice().reverse().map((op) => (
        <View key={op.operationId} style={styles.item}>
          <Text style={styles.summary}>{op.summary}</Text>
          <Text style={{ color: LABEL[op.status]?.color, fontWeight: '600' }}>{LABEL[op.status]?.text}</Text>
          {op.result?.reservationId ? <Text style={styles.meta}>Reserva #{op.result.reservationId} creada. Ya puedes pagarla.</Text> : null}
          {op.lastError ? <Text style={styles.error}>{op.lastError}</Text> : null}
          {op.conflicts?.map((c, i) => (
            <Text key={i} style={styles.error}>
              ⚠ {c.message}
              {c.detail?.shortages?.[0]?.alternatives?.length
                ? ` Disponible en: ${c.detail.shortages[0].alternatives.map((a: any) => a.branchName).join(', ')}` : ''}
            </Text>
          ))}
          {op.status !== 'PENDIENTE' && op.status !== 'ERROR' && op.status !== 'SINCRONIZANDO' ? (
            <Pressable onPress={() => void removeOperation(op.operationId)}><Text style={styles.link}>Quitar</Text></Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff8e6', borderRadius: 10, padding: 12, margin: 12, borderWidth: 1, borderColor: '#f3d18b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontWeight: '700', flex: 1 },
  button: { backgroundColor: '#182D2A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  item: { borderTopWidth: 1, borderTopColor: '#f0e2c0', paddingVertical: 6 },
  summary: { fontWeight: '600' },
  meta: { color: '#555', fontSize: 12 },
  error: { color: '#b91c1c', fontSize: 12 },
  link: { color: '#555', textDecorationLine: 'underline', fontSize: 12, marginTop: 2 },
});
