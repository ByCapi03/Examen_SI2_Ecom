import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { flush, getQueue, isFlushing, syncEvents } from './syncService';
import { OfflineOperation } from '../database/offlineQueue.repository';

/** Sincroniza automáticamente al volver la app a primer plano y cada 30 s. */
export function useAutoSync() {
  useEffect(() => {
    void flush();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void flush(); });
    const timer = setInterval(() => { void flush(); }, 30000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);
}

/** Estado de la cola offline para mostrar en pantalla. */
export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineOperation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const refresh = useCallback(async () => {
    const items = await getQueue();
    setQueue(items);
    setSyncing(isFlushing());
  }, []);
  useEffect(() => {
    void refresh();
    return syncEvents.subscribe(() => { void refresh(); });
  }, [refresh]);
  return { queue, syncing, syncNow: flush, refresh };
}
