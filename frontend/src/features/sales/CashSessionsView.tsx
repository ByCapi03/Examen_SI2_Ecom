import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Unlock, Lock, Scale, Building2, UserPlus, Store, ChevronRight, Plus } from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { useBranchScope } from '../branches/BranchScopeContext';
import { Card, KpiCard, Empty, Skeleton, Modal } from '../../components/dashboard/ui';

export interface CashSession {
  id: number;
  cashierId: number;
  branchId: number;
  cashierName: string;
  branchName: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  assigned: boolean;
}

interface Cashier { id: number; name: string; email: string; branchId: number | null; active: boolean; userRoles?: { active: boolean; role: { name: string } }[] }
interface BranchOpt { id: number; name: string; active: boolean }

type Filter = 'ALL' | 'OPEN' | 'CLOSED';

const errMsg = (e: any, fallback: string) => e?.response?.data?.message ?? fallback;

/**
 * Cajas de la empresa. ADMIN y ENCARGADO pueden abrir una caja a nombre de un cajero
 * y cerrar cualquier caja abierta de su alcance. `branchId` fija la sucursal (panel de sucursal).
 */
export const CashSessionsView = ({ branchId, embedded = false }: { branchId?: number; embedded?: boolean }) => {
  const { user } = useAuth();
  const { money, locale } = useSettings();
  const { scope } = useBranchScope();
  const isAdmin = !!user?.roles?.includes('ADMIN');
  const isManager = isAdmin || !!user?.roles?.includes('ENCARGADO');
  const fixedBranchId = branchId ?? (isAdmin ? scope?.id : user?.branchId ?? undefined) ?? undefined;

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState<CashSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/cash-sessions', { params: branchId ? { branchId } : undefined });
      setSessions(data);
    } catch (err: any) {
      setError(errMsg(err, 'Error al cargar las sesiones de caja'));
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const open = sessions.filter((s) => s.status === 'OPEN');
    const closed = sessions.filter((s) => s.status === 'CLOSED');
    return {
      open: open.length,
      closed: closed.length,
      openingTotal: open.reduce((a, s) => a + s.openingAmount, 0),
      diffTotal: closed.reduce((a, s) => a + (s.difference ?? 0), 0),
    };
  }, [sessions]);

  const visible = sessions.filter((s) => filter === 'ALL' || s.status === filter);
  const dt = (v: string | null) => (v ? new Date(v).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const amt = (v: number | null) => (v === null || v === undefined ? '—' : money(v));

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Todas', count: sessions.length },
    { key: 'OPEN', label: 'Abiertas', count: stats.open },
    { key: 'CLOSED', label: 'Cerradas', count: stats.closed },
  ];

  const steps = [
    ...(isAdmin ? [{ icon: <Building2 size={18} />, title: 'Crea una sucursal', text: 'Cada caja pertenece a una sucursal de tu empresa.', to: '/dashboard/branches', cta: 'Ir a Sucursales' }] : []),
    { icon: <UserPlus size={18} />, title: 'Crea un usuario con rol Cajero', text: 'Asígnale su sucursal. Cada cajero trabaja con una caja a la vez.', to: '/dashboard/users', cta: 'Ir a Usuarios' },
    { icon: <Store size={18} />, title: 'Abre su caja', text: 'Tú puedes abrirla desde aquí con el monto inicial, o el cajero puede hacerlo desde Punto de venta.' },
  ];

  const openButton = isManager && (
    <button className="dz-btn" onClick={() => { setNotice(null); setOpening(true); }}><Plus size={15} /> Abrir caja</button>
  );

  return (
    <>
      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18 }}>{error}</div>}
      {notice && <div role="status" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: 12, borderRadius: 12, marginBottom: 18 }}>{notice}</div>}

      {!embedded && (
        <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
          {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} />) : (
            <>
              <KpiCard label="Cajas abiertas ahora" value={String(stats.open)} icon={<Unlock size={16} />} tone="accent" />
              <KpiCard label="Turnos cerrados" value={String(stats.closed)} icon={<Lock size={16} />} />
              <KpiCard label="Efectivo inicial en cajas abiertas" value={money(stats.openingTotal)} icon={<Wallet size={16} />} />
              <KpiCard label="Diferencia acumulada" value={money(stats.diffTotal)} icon={<Scale size={16} />} tone={stats.diffTotal < 0 ? 'danger' : 'primary'} />
            </>
          )}
        </div>
      )}

      {!loading && sessions.length === 0 ? (
        <Card title="Aún no hay sesiones de caja" subtitle="Abre una caja para que un cajero empiece a vender." actions={openButton || undefined}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {steps.map((s, i) => (
              <li key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, border: '1px solid var(--atemporal-border)', borderRadius: 14, flexWrap: 'wrap' }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--atemporal-green)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}><span style={{ color: 'var(--atemporal-gold)', marginRight: 6 }}>{i + 1}.</span>{s.title}</div>
                  <div className="dz-sub" style={{ marginTop: 3 }}>{s.text}</div>
                </div>
                {'to' in s && s.to && <Link to={s.to} className="dz-btn ghost" style={{ textDecoration: 'none' }}>{s.cta} <ChevronRight size={14} /></Link>}
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card
          title="Historial de turnos"
          subtitle={isManager ? 'Abre cajas para tus cajeros y cierra las que queden abiertas' : 'Turnos de caja registrados'}
          actions={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="dz-tabs">
                {filters.map((f) => (
                  <button key={f.key} className={`dz-tab${filter === f.key ? ' on' : ''}`} onClick={() => setFilter(f.key)}>
                    {f.label} <span style={{ opacity: 0.7 }}>{f.count}</span>
                  </button>
                ))}
              </div>
              {openButton}
            </div>
          }
        >
          {loading ? <Skeleton h={220} /> : visible.length === 0 ? <Empty text="No hay sesiones con este estado" /> : (
            <div className="dz-scroll">
              <table className="dz-table">
                <thead>
                  <tr>
                    <th>Cajero</th>{!fixedBranchId && <th>Sucursal</th>}<th>Apertura</th><th className="r">Monto inicial</th>
                    <th>Cierre</th><th className="r">Esperado</th><th className="r">Monto de cierre</th><th className="r">Diferencia</th><th>Estado</th>{isManager && <th />}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>
                        {s.cashierName}
                        {s.assigned && <span title="Caja abierta por la administración" style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(201,144,74,0.18)', color: 'var(--atemporal-gold)' }}>ASIGNADA</span>}
                      </td>
                      {!fixedBranchId && <td>{s.branchName || '—'}</td>}
                      <td>{dt(s.openedAt)}</td>
                      <td className="r">{amt(s.openingAmount)}</td>
                      <td>{dt(s.closedAt)}</td>
                      <td className="r">{amt(s.expectedAmount)}</td>
                      <td className="r">{amt(s.closingAmount)}</td>
                      <td className="r" style={{ fontWeight: 700, color: s.difference ? (s.difference < 0 ? '#B91C1C' : '#15803D') : undefined }}>{amt(s.difference)}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em',
                          background: s.status === 'OPEN' ? 'rgba(22,163,74,0.14)' : 'var(--chart-track)',
                          color: s.status === 'OPEN' ? '#15803D' : 'var(--atemporal-muted)',
                        }}>{s.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}</span>
                      </td>
                      {isManager && (
                        <td className="r">
                          {s.status === 'OPEN' && <button className="dz-btn ghost" style={{ padding: '6px 12px' }} onClick={() => { setNotice(null); setClosing(s); }}>Cerrar caja</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {opening && (
        <OpenCashModal
          fixedBranchId={fixedBranchId}
          isAdmin={isAdmin}
          openCashierIds={new Set(sessions.filter((s) => s.status === 'OPEN').map((s) => s.cashierId))}
          onClose={() => setOpening(false)}
          onDone={(name) => { setOpening(false); setNotice(`Caja abierta para ${name}. Ya puede vender desde Punto de venta.`); void load(); }}
        />
      )}
      {closing && (
        <CloseCashModal
          session={closing}
          onClose={() => setClosing(null)}
          onDone={(s) => { setClosing(null); setNotice(`Caja de ${s.cashierName} cerrada.`); void load(); }}
        />
      )}
    </>
  );
};

const OpenCashModal = ({ fixedBranchId, isAdmin, openCashierIds, onClose, onDone }: {
  fixedBranchId?: number; isAdmin: boolean; openCashierIds: Set<number>; onClose: () => void; onDone: (cashierName: string) => void;
}) => {
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [branchId, setBranchId] = useState<number | ''>(fixedBranchId ?? '');
  const [cashierId, setCashierId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/users').then((r) => r.data as Cashier[]),
      isAdmin && !fixedBranchId ? api.get('/branches').then((r) => r.data as BranchOpt[]) : Promise.resolve([] as BranchOpt[]),
    ]).then(([u, b]) => { setCashiers(u); setBranches(b.filter((x) => x.active)); })
      .catch((e) => setErr(errMsg(e, 'No se pudieron cargar los cajeros')))
      .finally(() => setLoadingData(false));
  }, [isAdmin, fixedBranchId]);

  const branchCashiers = cashiers.filter((u) =>
    u.active && u.branchId === (branchId || -1) && u.userRoles?.some((r) => r.active && r.role.name === 'CAJERO'));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierId) { setErr('Selecciona un cajero.'); return; }
    const value = Number(amount);
    if (amount === '' || Number.isNaN(value) || value < 0) { setErr('Ingresa un monto inicial válido (0 o más).'); return; }
    setBusy(true); setErr(null);
    try {
      await api.post('/cash-sessions/open', { openingAmount: value, cashierId, ...(isAdmin ? { branchId } : {}) });
      onDone(cashiers.find((c) => c.id === cashierId)?.name ?? 'el cajero');
    } catch (e2: any) {
      setErr(errMsg(e2, 'No se pudo abrir la caja'));
    } finally { setBusy(false); }
  };

  const hasCashiers = branchCashiers.length > 0;

  return (
    <Modal title="Abrir caja" onClose={onClose} footer={
      <>
        <button type="button" className="dz-btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="open-cash-form" className="dz-btn" disabled={busy || !hasCashiers}>{busy ? 'Abriendo…' : 'Abrir caja'}</button>
      </>
    }>
      <form id="open-cash-form" onSubmit={submit}>
        {isAdmin && !fixedBranchId && (
          <label className="dz-field">Sucursal
            <select className="dz-input" value={branchId} onChange={(e) => { setBranchId(e.target.value ? Number(e.target.value) : ''); setCashierId(''); }} required>
              <option value="">Selecciona una sucursal</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}

        {loadingData ? <Skeleton h={60} /> : branchId && !hasCashiers ? (
          <div style={{ padding: 12, borderRadius: 12, background: 'var(--chart-track)', fontSize: '0.85rem', marginBottom: 14 }}>
            Esta sucursal no tiene cajeros activos. <Link to="/dashboard/users" onClick={onClose} style={{ color: 'var(--atemporal-gold)', fontWeight: 700 }}>Crea un usuario con rol Cajero</Link> y vuelve aquí.
          </div>
        ) : (
          <label className="dz-field">Cajero
            <select className="dz-input" value={cashierId} onChange={(e) => setCashierId(e.target.value ? Number(e.target.value) : '')} required disabled={!branchId}>
              <option value="">{branchId ? 'Selecciona un cajero' : 'Primero elige la sucursal'}</option>
              {branchCashiers.map((c) => {
                const busyCashier = openCashierIds.has(c.id);
                return <option key={c.id} value={c.id} disabled={busyCashier}>{c.name}{busyCashier ? ' (ya tiene caja abierta)' : ''}</option>;
              })}
            </select>
          </label>
        )}

        <label className="dz-field">Monto inicial en efectivo
          <input className="dz-input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
        </label>
        <p className="dz-sub" style={{ margin: '0 0 6px' }}>La caja queda a nombre del cajero seleccionado y se registra que fue abierta por la administración.</p>
        {err && <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 10, borderRadius: 10, fontSize: '0.84rem', marginTop: 10 }}>{err}</div>}
      </form>
    </Modal>
  );
};

const CloseCashModal = ({ session, onClose, onDone }: { session: CashSession; onClose: () => void; onDone: (s: CashSession) => void }) => {
  const { money } = useSettings();
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expected = session.expectedAmount ?? session.openingAmount;
  const counted = amount === '' ? null : Number(amount);
  const diff = counted === null || Number.isNaN(counted) ? null : counted - expected;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (counted === null || Number.isNaN(counted) || counted < 0) { setErr('Ingresa el efectivo contado (0 o más).'); return; }
    setBusy(true); setErr(null);
    try {
      await api.post(`/cash-sessions/${session.id}/close`, { closingAmount: counted });
      onDone(session);
    } catch (e2: any) {
      setErr(errMsg(e2, 'No se pudo cerrar la caja'));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Cerrar caja" onClose={onClose} footer={
      <>
        <button type="button" className="dz-btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="close-cash-form" className="dz-btn" disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar caja'}</button>
      </>
    }>
      <form id="close-cash-form" onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Info label="Cajero" value={session.cashierName} />
          <Info label="Sucursal" value={session.branchName || '—'} />
          <Info label="Monto inicial" value={money(session.openingAmount)} />
          <Info label="Esperado en caja" value={money(expected)} strong />
        </div>
        <label className="dz-field">Efectivo contado
          <input className="dz-input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus required />
        </label>
        {diff !== null && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--chart-track)', fontSize: '0.86rem', fontWeight: 700, color: diff === 0 ? 'var(--atemporal-text)' : diff < 0 ? '#B91C1C' : '#15803D' }}>
            {diff === 0 ? 'La caja cuadra exactamente.' : diff < 0 ? `Faltan ${money(Math.abs(diff))}` : `Sobran ${money(diff)}`}
          </div>
        )}
        <p className="dz-sub" style={{ margin: '12px 0 0' }}>Al cerrarla, {session.cashierName} ya no podrá vender con esta caja.</p>
        {err && <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 10, borderRadius: 10, fontSize: '0.84rem', marginTop: 10 }}>{err}</div>}
      </form>
    </Modal>
  );
};

const Info = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--chart-track)' }}>
    <div style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--atemporal-muted)' }}>{label}</div>
    <div style={{ fontWeight: strong ? 800 : 600, fontSize: strong ? '1.05rem' : '0.9rem' }}>{value}</div>
  </div>
);
