import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Unlock, Scale, Building2, UserPlus, Store, ChevronRight, Plus, Pencil, Trash2, Landmark } from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { Card, KpiCard, Empty, Skeleton, Modal } from '../../components/dashboard/ui';

export interface CashSession {
  id: number;
  cashierId: number;
  branchId: number;
  registerId: number | null;
  registerName: string | null;
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

interface Register {
  id: number;
  name: string;
  active: boolean;
  branchId: number;
  branchName: string;
  currentSession: { id: number; cashierId: number; cashierName: string; openedAt: string; openingAmount: number; assigned: boolean } | null;
}

interface Cashier { id: number; name: string; email: string; branchId: number | null; active: boolean; userRoles?: { active: boolean; role: { name: string } }[] }
interface BranchOpt { id: number; name: string; active: boolean }

type Filter = 'ALL' | 'OPEN' | 'CLOSED';

const errMsg = (e: any, fallback: string) => e?.response?.data?.message ?? (e?.response ? fallback : 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');

/**
 * Cajas de la empresa. Primero se CREA la caja de una sucursal (Caja 1, Caja Principal...) y luego se ABRE
 * un turno sobre ella con un cajero. ADMIN gestiona todas; ENCARGADO las de su sucursal.
 */
export const CashSessionsView = () => {
  const { user } = useAuth();
  const { money, locale } = useSettings();
  const isAdmin = !!user?.roles?.includes('ADMIN');
  const isManager = isAdmin || !!user?.roles?.includes('ENCARGADO');
  // El encargado trabaja siempre en su sucursal; el administrador elige la sucursal al crear una caja.
  const fixedBranchId = isAdmin ? undefined : user?.branchId ?? undefined;

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [editing, setEditing] = useState<Register | 'new' | null>(null);
  const [opening, setOpening] = useState<Register | null>(null);
  const [closing, setClosing] = useState<CashSession | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([
        api.get('/cash-sessions').then((x) => x.data as CashSession[]),
        isManager ? api.get('/cash-registers').then((x) => x.data as Register[]) : Promise.resolve([] as Register[]),
      ]);
      setSessions(s);
      setRegisters(r);
    } catch (err: any) {
      setError(errMsg(err, 'Error al cargar las cajas'));
    } finally {
      setLoading(false);
    }
  }, [isManager]);

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
    { key: 'ALL', label: 'Todos', count: sessions.length },
    { key: 'OPEN', label: 'Abiertos', count: stats.open },
    { key: 'CLOSED', label: 'Cerrados', count: stats.closed },
  ];

  const removeRegister = async (r: Register) => {
    if (!window.confirm(`¿Eliminar la caja "${r.name}"? Esta acción no se puede deshacer.`)) return;
    setNotice(null);
    try {
      await api.delete(`/cash-registers/${r.id}`);
      setNotice(`Caja "${r.name}" eliminada.`);
      void load();
    } catch (err: any) {
      setError(errMsg(err, 'No se pudo eliminar la caja'));
    }
  };

  const steps: { icon: React.ReactNode; title: string; text: string; to?: string; cta?: string; action?: React.ReactNode }[] = [
    ...(isAdmin && !fixedBranchId ? [{ icon: <Building2 size={18} />, title: 'Crea una sucursal', text: 'Cada caja pertenece a una sucursal de tu empresa.', to: '/dashboard/branches', cta: 'Ir a Sucursales' }] : []),
    { icon: <Landmark size={18} />, title: 'Crea la caja', text: 'Ponle un nombre (Caja 1, Caja Principal…). Una sucursal puede tener varias.', action: <button className="dz-btn" onClick={() => setEditing('new')}><Plus size={15} /> Crear caja</button> },
    { icon: <UserPlus size={18} />, title: 'Crea un usuario con rol Cajero', text: 'Asígnale su sucursal. Cada cajero trabaja con una caja a la vez.', to: '/dashboard/users', cta: 'Ir a Usuarios' },
    { icon: <Store size={18} />, title: 'Abre la caja', text: 'Desde aquí con el monto inicial, o el cajero la abre desde Punto de venta.' },
  ];

  return (
    <>
      {error && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>{error}</span>
          <button className="dz-btn ghost" style={{ padding: '6px 12px' }} onClick={() => void load()}>Reintentar</button>
        </div>
      )}
      {notice && <div role="status" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: 12, borderRadius: 12, marginBottom: 18 }}>{notice}</div>}

      <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} />) : (
          <>
            <KpiCard label="Cajas abiertas ahora" value={String(stats.open)} icon={<Unlock size={16} />} tone="accent" />
            <KpiCard label="Cajas creadas" value={String(registers.length)} icon={<Landmark size={16} />} />
            <KpiCard label="Efectivo inicial en cajas abiertas" value={money(stats.openingTotal)} icon={<Wallet size={16} />} />
            <KpiCard label="Diferencia acumulada" value={money(stats.diffTotal)} icon={<Scale size={16} />} tone={stats.diffTotal < 0 ? 'danger' : 'primary'} />
          </>
        )}
      </div>

      {/* ── 1) CAJAS: se crean primero ── */}
      {isManager && (
        <div style={{ marginBottom: 18 }}>
          <Card
            title="Cajas"
            subtitle={registers.length ? 'Crea las cajas de la sucursal y ábrelas con un cajero' : 'Aún no hay cajas creadas. Así empiezas:'}
            actions={registers.length > 0 ? <button className="dz-btn" onClick={() => { setNotice(null); setEditing('new'); }}><Plus size={15} /> Nueva caja</button> : undefined}
          >
            {loading ? <Skeleton h={120} /> : registers.length === 0 ? (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
                {steps.map((s, i) => (
                  <li key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, border: '1px solid var(--atemporal-border)', borderRadius: 14, flexWrap: 'wrap' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--atemporal-green)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{s.icon}</span>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}><span style={{ color: 'var(--atemporal-gold)', marginRight: 6 }}>{i + 1}.</span>{s.title}</div>
                      <div className="dz-sub" style={{ marginTop: 3 }}>{s.text}</div>
                    </div>
                    {s.action}
                    {s.to && <Link to={s.to} className="dz-btn ghost" style={{ textDecoration: 'none' }}>{s.cta} <ChevronRight size={14} /></Link>}
                  </li>
                ))}
              </ol>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                {registers.map((r) => {
                  const cur = r.currentSession;
                  const state = !r.active ? 'off' : cur ? 'busy' : 'free';
                  const pill = {
                    off: { label: 'DESACTIVADA', bg: 'rgba(220,38,38,0.12)', fg: '#B91C1C' },
                    busy: { label: 'EN USO', bg: 'rgba(22,163,74,0.14)', fg: '#15803D' },
                    free: { label: 'LIBRE', bg: 'var(--chart-track)', fg: 'var(--atemporal-muted)' },
                  }[state];
                  return (
                    <div key={r.id} className="dz-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, opacity: state === 'off' ? 0.75 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
                          {!fixedBranchId && <div className="dz-sub">{r.branchName}</div>}
                        </div>
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 999, background: pill.bg, color: pill.fg, whiteSpace: 'nowrap' }}>{pill.label}</span>
                      </div>

                      <div style={{ fontSize: '0.82rem', minHeight: 38, color: 'var(--atemporal-text)' }}>
                        {state === 'busy' && cur && (
                          <>
                            <b>{cur.cashierName}</b>{cur.assigned && <span style={{ marginLeft: 6, fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(201,144,74,0.18)', color: 'var(--atemporal-gold)' }}>ASIGNADA</span>}
                            <div className="dz-sub">Desde {dt(cur.openedAt)} · inicial {money(cur.openingAmount)}</div>
                          </>
                        )}
                        {state === 'free' && <span className="dz-sub">Lista para abrir un turno con un cajero.</span>}
                        {state === 'off' && <span className="dz-sub">No se puede abrir mientras esté desactivada.</span>}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {state === 'free' && <button className="dz-btn" style={{ padding: '7px 14px' }} onClick={() => { setNotice(null); setOpening(r); }}>Abrir caja</button>}
                        {state === 'busy' && cur && (
                          <button className="dz-btn ghost" style={{ padding: '7px 14px' }} onClick={() => {
                            const s = sessions.find((x) => x.id === cur.id);
                            if (s) { setNotice(null); setClosing(s); } else void load();
                          }}>Cerrar caja</button>
                        )}
                        <span style={{ flex: 1 }} />
                        <button className="dz-btn ghost" style={{ padding: '7px 9px' }} title="Editar" aria-label={`Editar ${r.name}`} onClick={() => { setNotice(null); setEditing(r); }}><Pencil size={14} /></button>
                        <button className="dz-btn ghost" style={{ padding: '7px 9px', color: state === 'busy' ? undefined : '#B91C1C' }} title={state === 'busy' ? 'Cierra el turno antes de eliminar' : 'Eliminar'} aria-label={`Eliminar ${r.name}`} disabled={state === 'busy'} onClick={() => void removeRegister(r)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── 2) HISTORIAL DE TURNOS ── */}
      {(loading || sessions.length > 0) && (
        <Card
          title="Historial de turnos"
          subtitle="Cada turno es una apertura de caja por un cajero"
          actions={
            <div className="dz-tabs">
              {filters.map((f) => (
                <button key={f.key} className={`dz-tab${filter === f.key ? ' on' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label} <span style={{ opacity: 0.7 }}>{f.count}</span>
                </button>
              ))}
            </div>
          }
        >
          {loading ? <Skeleton h={180} /> : visible.length === 0 ? <Empty text="No hay turnos con este estado" /> : (
            <div className="dz-scroll">
              <table className="dz-table">
                <thead>
                  <tr>
                    <th>Caja</th><th>Cajero</th>{!fixedBranchId && <th>Sucursal</th>}<th>Apertura</th><th className="r">Monto inicial</th>
                    <th>Cierre</th><th className="r">Esperado</th><th className="r">Monto de cierre</th><th className="r">Diferencia</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.registerName ?? <span style={{ color: 'var(--atemporal-muted)', fontWeight: 400 }}>—</span>}</td>
                      <td>{s.cashierName}</td>
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
                        }}>{s.status === 'OPEN' ? 'ABIERTO' : 'CERRADO'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {editing && (
        <RegisterModal
          register={editing === 'new' ? null : editing}
          fixedBranchId={fixedBranchId}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onDone={(msg) => { setEditing(null); setNotice(msg); void load(); }}
        />
      )}
      {opening && (
        <OpenCashModal
          register={opening}
          openCashierIds={new Set(sessions.filter((s) => s.status === 'OPEN').map((s) => s.cashierId))}
          onClose={() => setOpening(null)}
          onDone={(name) => { const r = opening; setOpening(null); setNotice(`${r.name} abierta para ${name}. Ya puede vender desde Punto de venta.`); void load(); }}
        />
      )}
      {closing && (
        <CloseCashModal
          session={closing}
          onClose={() => setClosing(null)}
          onDone={(s) => { setClosing(null); setNotice(`${s.registerName ?? 'Caja'} de ${s.cashierName} cerrada.`); void load(); }}
        />
      )}
    </>
  );
};

const RegisterModal = ({ register, fixedBranchId, isAdmin, onClose, onDone }: {
  register: Register | null; fixedBranchId?: number; isAdmin: boolean; onClose: () => void; onDone: (msg: string) => void;
}) => {
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [name, setName] = useState(register?.name ?? '');
  const [active, setActive] = useState(register?.active ?? true);
  const [branchId, setBranchId] = useState<number | ''>(fixedBranchId ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsBranch = !register && isAdmin && !fixedBranchId;

  useEffect(() => {
    if (!needsBranch) return;
    api.get('/branches').then((r) => setBranches((r.data as BranchOpt[]).filter((b) => b.active))).catch(() => setErr('No se pudieron cargar las sucursales'));
  }, [needsBranch]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Escribe un nombre para la caja.'); return; }
    if (needsBranch && !branchId) { setErr('Selecciona la sucursal.'); return; }
    setBusy(true); setErr(null);
    try {
      if (register) {
        await api.patch(`/cash-registers/${register.id}`, { name: name.trim(), active });
        onDone(`Caja "${name.trim()}" actualizada.`);
      } else {
        await api.post('/cash-registers', { name: name.trim(), ...(isAdmin ? { branchId: fixedBranchId ?? branchId } : {}) });
        onDone(`Caja "${name.trim()}" creada. Ahora puedes abrirla con un cajero.`);
      }
    } catch (e2: any) {
      setErr(errMsg(e2, 'No se pudo guardar la caja'));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={register ? 'Editar caja' : 'Nueva caja'} onClose={onClose} footer={
      <>
        <button type="button" className="dz-btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="register-form" className="dz-btn" disabled={busy}>{busy ? 'Guardando…' : register ? 'Guardar' : 'Crear caja'}</button>
      </>
    }>
      <form id="register-form" onSubmit={submit}>
        {needsBranch && (
          <label className="dz-field">Sucursal
            <select className="dz-input" value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')} required>
              <option value="">Selecciona una sucursal</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <label className="dz-field">Nombre de la caja
          <input className="dz-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej.: Caja 1, Caja Principal" autoFocus required />
        </label>
        {register && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', marginBottom: 6 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ accentColor: 'var(--atemporal-green)', width: 16, height: 16 }} /> Caja activa
          </label>
        )}
        <p className="dz-sub" style={{ margin: '6px 0 0' }}>{register ? 'Una caja desactivada no se puede abrir.' : 'Después de crearla, ábrela con un cajero y un monto inicial.'}</p>
        {err && <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 10, borderRadius: 10, fontSize: '0.84rem', marginTop: 10 }}>{err}</div>}
      </form>
    </Modal>
  );
};

const OpenCashModal = ({ register, openCashierIds, onClose, onDone }: {
  register: Register; openCashierIds: Set<number>; onClose: () => void; onDone: (cashierName: string) => void;
}) => {
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [cashierId, setCashierId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/users').then((r) => setCashiers(r.data as Cashier[]))
      .catch((e) => setErr(errMsg(e, 'No se pudieron cargar los cajeros')))
      .finally(() => setLoadingData(false));
  }, []);

  const branchCashiers = cashiers.filter((u) =>
    u.active && u.branchId === register.branchId && u.userRoles?.some((r) => r.active && r.role.name === 'CAJERO'));
  const hasCashiers = branchCashiers.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierId) { setErr('Selecciona un cajero.'); return; }
    const value = Number(amount);
    if (amount === '' || Number.isNaN(value) || value < 0) { setErr('Ingresa un monto inicial válido (0 o más).'); return; }
    setBusy(true); setErr(null);
    try {
      await api.post('/cash-sessions/open', { openingAmount: value, cashierId, registerId: register.id });
      onDone(cashiers.find((c) => c.id === cashierId)?.name ?? 'el cajero');
    } catch (e2: any) {
      setErr(errMsg(e2, 'No se pudo abrir la caja'));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Abrir ${register.name}`} onClose={onClose} footer={
      <>
        <button type="button" className="dz-btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="open-cash-form" className="dz-btn" disabled={busy || !hasCashiers}>{busy ? 'Abriendo…' : 'Abrir caja'}</button>
      </>
    }>
      <form id="open-cash-form" onSubmit={submit}>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--chart-track)', marginBottom: 14, fontSize: '0.86rem' }}>
          <b>{register.name}</b> · {register.branchName}
        </div>

        {loadingData ? <Skeleton h={60} /> : !hasCashiers ? (
          <div style={{ padding: 12, borderRadius: 12, background: 'var(--chart-track)', fontSize: '0.85rem', marginBottom: 14 }}>
            Esta sucursal no tiene cajeros activos. <Link to="/dashboard/users" onClick={onClose} style={{ color: 'var(--atemporal-gold)', fontWeight: 700 }}>Crea un usuario con rol Cajero</Link> y vuelve aquí.
          </div>
        ) : (
          <label className="dz-field">Cajero
            <select className="dz-input" value={cashierId} onChange={(e) => setCashierId(e.target.value ? Number(e.target.value) : '')} required>
              <option value="">Selecciona un cajero</option>
              {branchCashiers.map((c) => {
                const inUse = openCashierIds.has(c.id);
                return <option key={c.id} value={c.id} disabled={inUse}>{c.name}{inUse ? ' (ya tiene una caja abierta)' : ''}</option>;
              })}
            </select>
          </label>
        )}

        <label className="dz-field">Monto inicial en efectivo
          <input className="dz-input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
        </label>
        <p className="dz-sub" style={{ margin: '0 0 6px' }}>El turno queda a nombre del cajero y se registra que fue abierto por la administración.</p>
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
    <Modal title={`Cerrar ${session.registerName ?? 'caja'}`} onClose={onClose} footer={
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
