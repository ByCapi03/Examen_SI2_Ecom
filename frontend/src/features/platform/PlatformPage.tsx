import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, DollarSign, AlertTriangle, PauseCircle, TrendingUp, RefreshCw, Search } from 'lucide-react';
import { api } from '../../api/axios';
import { DashStyles, PageHeader, Card, KpiCard } from '../../components/dashboard/ui';
import { money, fmtDate, STATUS_LABEL, price, yearlySaving } from './planUtils';
import type { PlanInfo, Cycle } from './planUtils';

interface Row {
  id: number; name: string; slug: string; active: boolean; createdAt: string; adminEmail: string | null;
  planCode: string; planName: string; maxBranches: number; maxProducts: number | null; maxUsers: number | null;
  billingCycle: Cycle; startDate: string; endDate: string | null; effectiveStatus: string;
  branches: number; products: number; users: number;
}
interface Overview { tenants: number; active: number; suspended: number; expired: number; newLast30: number; mrr: number; arr: number; byPlan: { code: string; count: number }[] }

const Usage = ({ used, max }: { used: number; max: number | null }) => {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <span title={max ? `${used} de ${max}` : `${used} (ilimitado)`} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {used}/{max ?? '∞'}
      {max ? <span style={{ display: 'inline-block', width: 34, height: 5, background: 'var(--chart-track, #eee)', borderRadius: 3, marginLeft: 6, verticalAlign: 'middle' }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 100 ? '#C2410C' : 'var(--atemporal-gold)' }} />
      </span> : null}
    </span>
  );
};

/** Panel de la plataforma (SUPERADMIN): empresas, planes, vigencias, ingresos y suspensiones. */
export const PlatformPage = () => {
  const [ov, setOv] = useState<Overview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'>('ALL');
  const [edit, setEdit] = useState<Row | null>(null);
  const [planCode, setPlanCode] = useState('');
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [days, setDays] = useState(15);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, t, p] = await Promise.all([api.get('/saas/admin/overview'), api.get('/saas/admin/tenants'), api.get('/saas/plans')]);
      setOv(o.data); setRows(t.data); setPlans(p.data);
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.message || 'No se pudo cargar el panel.' });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => rows.filter((r) =>
    (filter === 'ALL' || r.effectiveStatus === filter) &&
    (!q.trim() || `${r.name} ${r.slug} ${r.adminEmail ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, filter]);

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); setEdit(null); }
    catch (e: any) { setMsg({ ok: false, text: e.response?.data?.message || 'La operación falló.' }); }
    finally { setBusy(false); }
  };

  const open = (r: Row) => { setEdit(r); setPlanCode(r.planCode); setCycle(r.billingCycle); setDays(15); setMsg(null); };
  const selPlan = plans.find((p) => p.code === planCode);

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader title="Plataforma" subtitle="Empresas clientes, planes, vigencias e ingresos del SaaS"
        actions={<button className="dz-btn ghost" onClick={() => void load()}><RefreshCw size={15} /> Actualizar</button>} />

      {msg && <div style={{ padding: 10, borderRadius: 8, marginBottom: 14, fontSize: '0.86rem', background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b' }}>{msg.text}</div>}

      <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
        <KpiCard label="Empresas" value={String(ov?.tenants ?? '—')} icon={<Building2 size={15} />} />
        <KpiCard label="Activas" value={String(ov?.active ?? '—')} icon={<TrendingUp size={15} />} />
        <KpiCard label="Ingreso mensual (MRR)" value={ov ? money(ov.mrr) : '—'} icon={<DollarSign size={15} />} tone="accent" />
        <KpiCard label="Ingreso anual (ARR)" value={ov ? money(ov.arr) : '—'} icon={<DollarSign size={15} />} tone="accent" />
        <KpiCard label="Vencidas" value={String(ov?.expired ?? '—')} icon={<AlertTriangle size={15} />} tone="danger" />
        <KpiCard label="Suspendidas" value={String(ov?.suspended ?? '—')} icon={<PauseCircle size={15} />} tone="danger" />
      </div>

      <Card title="Empresas" subtitle={`${shown.length} de ${rows.length} · ${ov?.newLast30 ?? 0} nuevas en 30 días`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: 11, color: 'var(--atemporal-muted)' }} />
              <input className="dz-input" style={{ paddingLeft: 28, width: 190 }} placeholder="Buscar empresa o correo" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="dz-input" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="ALL">Todas</option><option value="ACTIVE">Activas</option><option value="EXPIRED">Vencidas</option><option value="SUSPENDED">Suspendidas</option>
            </select>
          </div>}>
        <div className="dz-scroll">
          <table className="dz-table">
            <thead><tr>
              <th>Empresa</th><th>Plan</th><th>Ciclo</th><th>Vence</th><th>Estado</th>
              <th className="c">Sucursales</th><th className="c">Productos</th><th className="c">Usuarios</th><th className="r">Acciones</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9}>Cargando…</td></tr>}
              {!loading && shown.length === 0 && <tr><td colSpan={9} style={{ color: 'var(--atemporal-muted)' }}>Sin resultados</td></tr>}
              {shown.map((r) => {
                const st = STATUS_LABEL[r.effectiveStatus] ?? STATUS_LABEL.ACTIVE;
                return (
                  <tr key={r.id}>
                    <td><b>{r.name}</b><div style={{ fontSize: '0.74rem', color: 'var(--atemporal-muted)' }}>/t/{r.slug}{r.adminEmail ? ` · ${r.adminEmail}` : ''}</div></td>
                    <td>{r.planName}</td>
                    <td>{r.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}</td>
                    <td>{r.endDate ? fmtDate(r.endDate) : 'Sin vencimiento'}</td>
                    <td><span style={{ padding: '3px 9px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: st.bg, color: st.fg }}>{st.text}</span></td>
                    <td className="c"><Usage used={r.branches} max={r.maxBranches} /></td>
                    <td className="c"><Usage used={r.products} max={r.maxProducts} /></td>
                    <td className="c"><Usage used={r.users} max={r.maxUsers} /></td>
                    <td className="r"><button className="dz-btn ghost" onClick={() => open(r)}>Gestionar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {ov && ov.byPlan.length > 0 && (
        <Card title="Empresas por plan" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ov.byPlan.map((b) => (
              <div key={b.code} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--chart-track, #EEEAE1)', minWidth: 120 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--atemporal-muted)' }}>{b.code}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{b.count}</div>
              </div>))}
          </div>
        </Card>
      )}

      {edit && (
        <div className="dz-modal-back" onClick={() => !busy && setEdit(null)}>
          <div className="dz-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="dz-modal-head"><h3>{edit.name}</h3><button onClick={() => setEdit(null)} aria-label="Cerrar">×</button></div>
            <div style={{ padding: '4px 20px 20px', display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.86rem' }}>Plan y ciclo de cobro</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <select className="dz-input" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                    {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                  <div className="dz-tabs">
                    <button className={`dz-tab${cycle === 'MONTHLY' ? ' on' : ''}`} onClick={() => setCycle('MONTHLY')}>Mensual</button>
                    <button className={`dz-tab${cycle === 'YEARLY' ? ' on' : ''}`} onClick={() => setCycle('YEARLY')}>Anual</button>
                  </div>
                </div>
                {selPlan && (
                  <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--atemporal-muted)' }}>
                    {Number(selPlan.priceMonthly) === 0 ? 'Plan gratuito (sin vencimiento).' : <>Cobro: <b>{money(price(selPlan, cycle))}</b> {cycle === 'YEARLY' ? `por año (ahorra ${money(yearlySaving(selPlan))})` : 'por mes'}.</>}
                  </p>
                )}
                <button className="dz-btn" disabled={busy} onClick={() => run(() => api.patch(`/saas/admin/tenants/${edit.id}/plan`, { planCode, billingCycle: cycle }), 'Plan actualizado; el período se reinició.')}>
                  Aplicar plan / renovar
                </button>
              </div>
              <div style={{ borderTop: '1px solid var(--atemporal-border)', paddingTop: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.86rem' }}>Días de cortesía</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="dz-input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(+e.target.value)} style={{ width: 90 }} />
                  <button className="dz-btn ghost" disabled={busy} onClick={() => run(() => api.patch(`/saas/admin/tenants/${edit.id}/extend`, { days }), `Vigencia extendida ${days} días.`)}>Extender</button>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--atemporal-border)', paddingTop: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.86rem' }}>Acceso de la empresa</div>
                <button className="dz-btn" disabled={busy} style={{ background: edit.active ? '#B91C1C' : '#15803D' }}
                  onClick={() => run(() => api.patch(`/saas/admin/tenants/${edit.id}/active`, { active: !edit.active }), edit.active ? 'Empresa suspendida.' : 'Empresa reactivada.')}>
                  {edit.active ? 'Suspender empresa' : 'Reactivar empresa'}
                </button>
                <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: 'var(--atemporal-muted)' }}>Suspendida: su personal no puede iniciar sesión y su tienda deja de mostrarse.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
