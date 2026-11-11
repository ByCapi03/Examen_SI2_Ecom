import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { api } from '../api/api';
import { colors, radius, spacing, typography } from '../theme/theme';

interface PushStatus { serverPushReady: boolean; devices: number; platforms: string[]; hint: string }

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/** Diagnóstico de notificaciones push: ¿este teléfono quedó registrado y el servidor puede enviarle avisos? */
export const PushDiagnostics: React.FC = () => {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus((await api.get<PushStatus>('/notifications/status')).data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sendTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/notifications/test');
      setResult({ ok: !!data.success, text: data.message });
    } catch (err: any) {
      setResult({ ok: false, text: err?.response?.data?.message ?? 'No se pudo contactar al servidor.' });
    } finally {
      setLoading(false);
      void load();
    }
  };

  const line = (ok: boolean, text: string) => (
    <Text style={[styles.line, { color: ok ? '#15803d' : '#b45309' }]}>{ok ? '✓' : '•'} {text}</Text>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Notificaciones push</Text>
      {IS_EXPO_GO
        ? line(false, 'Estás en Expo Go: no recibe push. Usa la app compilada (development build).')
        : line(true, 'App compilada: puede recibir push.')}
      {status ? (
        <>
          {line(status.devices > 0, status.devices > 0 ? `Este usuario tiene ${status.devices} dispositivo(s) registrado(s) (${status.platforms.join(', ')})` : 'Ningún dispositivo registrado todavía')}
          {line(status.serverPushReady || status.devices > 0, status.hint)}
        </>
      ) : <Text style={styles.line}>No se pudo leer el estado del servidor.</Text>}
      {result ? <Text style={[styles.line, { color: result.ok ? '#15803d' : '#b91c1c', fontWeight: '700' }]}>{result.text}</Text> : null}
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => void sendTest()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviarme una notificación de prueba</Text>}
        </Pressable>
        <Pressable style={[styles.button, styles.ghost]} onPress={() => void load()} disabled={loading}>
          <Text style={[styles.buttonText, { color: colors.primary }]}>Actualizar</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, gap: 6 },
  title: { ...typography.h3, marginBottom: 4 },
  line: { ...typography.body },
  row: { flexDirection: 'row', gap: 8, marginTop: spacing.sm, flexWrap: 'wrap' },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: colors.white, fontWeight: '700' },
});
