import { useCallback, useEffect, useState } from 'react';
import { flush, getQueue, getSyncMeta, startAutoSync, syncEvents } from './syncManager';
import type { OutboxItem } from './db';

/** Estado de conectividad + cola offline para la UI. */
export function useOffline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const [meta, setMeta] = useState(getSyncMeta());

  const refresh = useCallback(async () => {
    const items = await getQueue();
    setOnline(navigator.onLine);
    setQueue(items);
    setMeta({ ...getSyncMeta() });
  }, []);

  useEffect(() => {
    startAutoSync();
    queueMicrotask(() => { void refresh(); });
    return syncEvents.subscribe(() => { void refresh(); });
  }, [refresh]);

  const pending = queue.filter((i) => i.status === 'PENDIENTE' || i.status === 'ERROR' || i.status === 'SINCRONIZANDO');
  const withIssues = queue.filter((i) => i.status === 'RECHAZADA' || i.status === 'CON_CONFLICTO');

  return { online, queue, pending, withIssues, ...meta, syncNow: flush, refresh };
}
