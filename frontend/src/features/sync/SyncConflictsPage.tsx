import { useEffect, useState } from 'react';
import { api } from '../../api/axios';

interface Conflict {
  id: number;
  operationId: string;
  type: string;
  status: 'PENDIENTE' | 'RESUELTO';
  branchId: number | null;
  saleId: number | null;
  message: string;
  detail: any;
  resolutionAction: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  STOCK_SHORTFALL: 'Faltante de stock',
  PRICE_CHANGED: 'Precio distinto',
  CASH_SESSION_CLOSED: 'Caja cerrada',
  STOCK_UNAVAILABLE: 'Reserva sin stock',
  INVALID_DATA: 'Datos inválidos',
};

const ACTIONS: Record<string, { value: string; label: string }[]> = {
  STOCK_SHORTFALL: [
    { value: 'AJUSTAR_INVENTARIO', label: 'Reconocer faltante (ajuste)' },
    { value: 'ANULAR_VENTA', label: 'Anular venta y devolver stock' },
  ],
  PRICE_CHANGED: [{ value: 'ACEPTAR', label: 'Aceptar precio cobrado' }, { value: 'ANULAR_VENTA', label: 'Anular venta' }],
  CASH_SESSION_CLOSED: [{ value: 'ACEPTAR', label: 'Conciliado en arqueo' }],
  STOCK_UNAVAILABLE: [{ value: 'DESCARTAR', label: 'Descartar (cliente notificado)' }],
  INVALID_DATA: [{ value: 'DESCARTAR', label: 'Descartar' }],
};

/** Bandeja de conflictos de sincronización offline (ADMIN / ENCARGADO). */
export const SyncConflictsPage = () => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [filter, setFilter] = useState<'PENDIENTE' | 'RESUELTO' | ''>('PENDIENTE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/sync/conflicts', { params: filter ? { status: filter } : {} });
      setConflicts(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudieron cargar los conflictos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [filter]);

  const resolve = async (c: Conflict, action: string) => {
    if (action === 'ANULAR_VENTA' && !confirm(`¿Anular la venta #${c.saleId}? Se devolverá el stock descontado.`)) return;
    try {
      await api.patch(`/sync/conflicts/${c.id}/resolve`, { action, notes: notes[c.id] || undefined });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'No se pudo resolver el conflicto');
    }
  };

  return (
    <div style={{ paddingTop: 24 }}>
      <h2 style={{ marginBottom: 4 }}>Conflictos de sincronización</h2>
      <p style={{ color: '#666', marginTop: 0 }}>
        Operaciones registradas sin conexión que, al sincronizarse, no coincidieron con el estado del servidor.
        Política: la venta física en efectivo prevalece (nunca se pierde dinero); las reservas sin stock se rechazan.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['PENDIENTE', 'RESUELTO', ''] as const).map((f) => (
          <button key={f || 'all'} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ccc', background: filter === f ? 'var(--atemporal-green)' : '#fff', color: filter === f ? '#fff' : '#333', cursor: 'pointer' }}>
            {f === 'PENDIENTE' ? 'Pendientes' : f === 'RESUELTO' ? 'Resueltos' : 'Todos'}
          </button>
        ))}
      </div>
      {error && <div style={{ color: '#721c24', background: '#f8d7da', padding: 10, borderRadius: 4 }}>{error}</div>}
      {loading && <div>Cargando…</div>}
      {!loading && conflicts.length === 0 && !error && <div style={{ color: '#666' }}>No hay conflictos {filter === 'PENDIENTE' ? 'pendientes' : ''}.</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {conflicts.map((c) => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid var(--atemporal-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>#{c.id} · {TYPE_LABEL[c.type] ?? c.type}</strong>
              <span style={{ color: c.status === 'PENDIENTE' ? '#b45309' : '#15803d', fontWeight: 600 }}>{c.status}</span>
            </div>
            <div style={{ margin: '6px 0' }}>{c.message}</div>
            <div style={{ fontSize: 12, color: '#777' }}>
              {new Date(c.createdAt).toLocaleString()} · Operación {c.operationId.slice(0, 8).toUpperCase()}
              {c.saleId ? ` · Venta #${c.saleId}` : ''}{c.branchId ? ` · Sucursal #${c.branchId}` : ''}
            </div>
            {c.status === 'RESUELTO' ? (
              <div style={{ fontSize: 13, marginTop: 6 }}>Resolución: <b>{c.resolutionAction}</b>{c.resolutionNotes ? ` — ${c.resolutionNotes}` : ''}</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input placeholder="Observación (opcional)" value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                  style={{ flex: '1 1 200px', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
                {(ACTIONS[c.type] ?? [{ value: 'ACEPTAR', label: 'Marcar resuelto' }]).map((a) => (
                  <button key={a.value} onClick={() => void resolve(c, a.value)}
                    style={{ padding: '6px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', color: '#fff', background: a.value === 'ANULAR_VENTA' ? '#b91c1c' : 'var(--atemporal-green)' }}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
