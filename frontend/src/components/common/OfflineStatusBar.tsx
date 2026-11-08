import { useState } from 'react';
import { useOffline } from '../../offline/useOffline';
import { discard } from '../../offline/syncManager';
import type { OutboxItem } from '../../offline/db';

const STATUS_STYLE: Record<OutboxItem['status'], { bg: string; fg: string; label: string }> = {
  PENDIENTE: { bg: '#fff3cd', fg: '#856404', label: 'Pendiente' },
  SINCRONIZANDO: { bg: '#d1ecf1', fg: '#0c5460', label: 'Sincronizando' },
  SINCRONIZADA: { bg: '#d4edda', fg: '#155724', label: 'Sincronizada' },
  CON_CONFLICTO: { bg: '#ffe5d0', fg: '#8a4b08', label: 'Con conflicto' },
  RECHAZADA: { bg: '#f8d7da', fg: '#721c24', label: 'Rechazada' },
  ERROR: { bg: '#f8d7da', fg: '#721c24', label: 'Reintentará' },
};

/**
 * Indicador flotante de conectividad y cola de sincronización.
 * Muestra operaciones pendientes, resultados y conflictos devueltos por el servidor.
 */
export const OfflineStatusBar = () => {
  const { online, queue, pending, withIssues, flushing, lastSyncAt, syncNow } = useOffline();
  const [open, setOpen] = useState(false);

  if (online && queue.length === 0) return null;

  const color = !online ? '#b45309' : pending.length ? '#1d4ed8' : withIssues.length ? '#b91c1c' : '#15803d';
  const label = !online
    ? `Sin conexión${pending.length ? ` · ${pending.length} pendiente(s)` : ''}`
    : flushing ? 'Sincronizando…'
    : pending.length ? `${pending.length} operación(es) por sincronizar`
    : withIssues.length ? `${withIssues.length} operación(es) requieren atención`
    : 'Todo sincronizado';

  return (
    <div style={{ position: 'fixed', right: 16, top: 72, zIndex: 1000, maxWidth: 'calc(100vw - 32px)', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: color, color: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,.2)', cursor: 'pointer' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#86efac' : '#fde68a' }} />
        {label}
      </button>
      {open && (
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', width: 380, maxWidth: '100%', maxHeight: 420, overflowY: 'auto', marginTop: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Operaciones offline</strong>
            <button onClick={() => void syncNow()} disabled={!online || flushing}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: online ? 'var(--atemporal-green, #182D2A)' : '#999', color: '#fff', cursor: online ? 'pointer' : 'not-allowed' }}>
              Sincronizar ahora
            </button>
          </div>
          {lastSyncAt && <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Última sincronización: {new Date(lastSyncAt).toLocaleString()}</div>}
          {queue.length === 0 && <div style={{ color: '#666' }}>No hay operaciones registradas sin conexión.</div>}
          {[...queue].reverse().map((item) => {
            const st = STATUS_STYLE[item.status];
            return (
              <div key={item.operationId} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{item.summary}</span>
                  <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: '1px 8px', fontSize: 12, whiteSpace: 'nowrap', height: 'fit-content' }}>{st.label}</span>
                </div>
                <div style={{ color: '#777', fontSize: 12 }}>
                  {new Date(item.clientCreatedAt).toLocaleString()} · {item.operationId.slice(0, 8).toUpperCase()}
                  {item.result?.saleId ? ` · Venta #${item.result.saleId}` : ''}
                  {item.result?.reservationId ? ` · Reserva #${item.result.reservationId}` : ''}
                </div>
                {item.lastError && <div style={{ color: '#721c24', fontSize: 12 }}>{item.lastError}</div>}
                {item.conflicts?.map((c, i) => (
                  <div key={i} style={{ color: '#8a4b08', fontSize: 12 }}>⚠ {c.message}
                    {c.detail?.shortages?.[0]?.alternatives?.length > 0 && (
                      <> — disponible en: {c.detail.shortages[0].alternatives.map((a: any) => `${a.branchName} (${a.available})`).join(', ')}</>
                    )}
                  </div>
                ))}
                {(item.status === 'SINCRONIZADA' || item.status === 'RECHAZADA' || item.status === 'CON_CONFLICTO') && (
                  <button onClick={() => void discard(item.operationId)} style={{ marginTop: 4, fontSize: 12, background: 'none', border: 'none', color: '#555', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                    Quitar de la lista
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
