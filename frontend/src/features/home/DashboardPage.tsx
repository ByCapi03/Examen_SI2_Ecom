import { useEffect, useState } from 'react';
import { StoreLinkCard } from '../../components/common/StoreLinkCard';
import { Link } from 'react-router-dom';
import {
  Wallet, Receipt, CalendarCheck, AlertTriangle, Users, TrendingUp, BrainCircuit, Sparkles, RefreshCw, ArrowRight,
} from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { usePlan } from '../saas/PlanContext';
import {
  DashStyles, PageHeader, PlanBadge, Card, KpiCard, AreaChart, DonutChart, HBarChart, ColumnChart, Funnel, Skeleton, Empty, SERIES,
} from '../../components/dashboard/ui';
import { Sparkline } from '../ai-reports/ReportChart';

interface DashboardMetrics {
  salesTodayAmount: number;
  salesTodayCount: number;
  activeReservations: number;
  resPendientes: number;
  resConfirmadasPreparando: number;
  resListas: number;
  activeCashiers: number;
  lowStockCount: number;
  salesLast7Days: { date: string; amount: number; count: number }[];
  salesByChannel: { POS: number; WEB: number; MOVIL: number };
  topProducts: { productId: number; productName: string; unitsSold: number; revenue: number }[];
  salesByBranch?: { branchId: number; branchName: string; totalAmount: number; salesCount: number }[];
  salesBySeason?: { seasonName: string; revenue: number }[];
  salesByCollection?: { collectionName: string; revenue: number }[];
}

export const DashboardPage = () => {
  const { user } = useAuth();
  const { t, money, num, locale } = useSettings();
  const { tenant } = usePlan();
  const isAdmin = !!user?.roles?.includes('ADMIN');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [f, setF] = useState({ startDate: '', endDate: '', branchId: '', channel: '' });

  const fetchMetrics = async (filters = f) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (isAdmin && filters.branchId) params.branchId = filters.branchId;
      if (filters.channel) params.channel = filters.channel;
      const { data } = await api.get('/dashboard/metrics', { params });
      setMetrics(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar las métricas del dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics();
    if (isAdmin) api.get('/branches').then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  const days = metrics?.salesLast7Days ?? [];
  const weekTotal = days.reduce((s, d) => s + Number(d.amount), 0);
  const weekCount = days.reduce((s, d) => s + Number(d.count), 0);
  const today = days[days.length - 1]?.amount ?? 0;
  const yesterday = days[days.length - 2]?.amount ?? 0;
  const deltaToday = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;
  const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: '2-digit' });

  const channelSlices = metrics ? [
    { label: 'POS (tienda)', value: Number(metrics.salesByChannel.POS) || 0 },
    { label: 'Web', value: Number(metrics.salesByChannel.WEB) || 0 },
    { label: 'Móvil', value: Number(metrics.salesByChannel.MOVIL) || 0 },
  ] : [];

  const moneyC = (v: number) => money(v, { compact: true });

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader
        title={t('dash.title')}
        subtitle={`${tenant?.name ? tenant.name + ' · ' : ''}${t('dash.subtitle')}`}
        badge={<PlanBadge />}
        actions={<button className="dz-btn ghost" onClick={() => void fetchMetrics()}><RefreshCw size={15} /> Actualizar</button>}
      />

      <StoreLinkCard />

      {/* Slicers */}
      <div className="dz-card" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Slicer label={t('filters.from')}><input type="date" className="dz-input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Slicer>
        <Slicer label={t('filters.to')}><input type="date" className="dz-input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Slicer>
        {isAdmin && (
          <Slicer label={t('filters.branch')}>
            <select className="dz-input" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
              <option value="">{t('filters.all')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Slicer>
        )}
        <Slicer label={t('filters.channel')}>
          <select className="dz-input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
            <option value="">{t('filters.all')}</option>
            <option value="POS">POS</option>
            <option value="WEB">Web</option>
            <option value="MOVIL">Móvil</option>
          </select>
        </Slicer>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="dz-btn ghost" onClick={() => { const c = { startDate: '', endDate: '', branchId: '', channel: '' }; setF(c); void fetchMetrics(c); }}>{t('filters.clear')}</button>
          <button className="dz-btn" onClick={() => void fetchMetrics()}>{t('filters.apply')}</button>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18 }}>{error}</div>}

      {/* KPIs */}
      <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
        {loading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={112} />) : metrics && (
          <>
            <KpiCard label={t('kpi.salesToday')} value={money(metrics.salesTodayAmount)} icon={<Wallet size={16} />} delta={deltaToday} spark={days.map((d) => d.amount)} />
            <KpiCard label={t('kpi.ordersToday')} value={num(metrics.salesTodayCount)} icon={<Receipt size={16} />} spark={days.map((d) => d.count)} />
            <KpiCard label={t('kpi.week')} value={moneyC(weekTotal)} icon={<TrendingUp size={16} />} tone="accent" />
            <KpiCard label={t('kpi.avgTicket')} value={money(weekCount ? weekTotal / weekCount : 0)} icon={<Receipt size={16} />} />
            <KpiCard label={t('kpi.reservations')} value={num(metrics.activeReservations)} icon={<CalendarCheck size={16} />} tone="accent" />
            <KpiCard label={t('kpi.lowStock')} value={num(metrics.lowStockCount)} icon={<AlertTriangle size={16} />} tone={metrics.lowStockCount > 0 ? 'danger' : 'primary'} />
          </>
        )}
      </div>

      {/* Tendencia + Canal */}
      <div className="dz-grid dz-2-1" style={{ marginBottom: 18 }}>
        <Card title={t('chart.trend')} subtitle="Últimos 7 días · monto vendido">
          {loading ? <Skeleton h={240} /> : <AreaChart points={days.map((d) => ({ label: short(d.date), value: Number(d.amount) }))} format={moneyC} />}
        </Card>
        <Card title={t('chart.channel')} subtitle="Participación por canal de venta">
          {loading ? <Skeleton h={200} /> : <DonutChart slices={channelSlices} format={moneyC} />}
        </Card>
      </div>

      {/* Top productos + Sucursales */}
      <div className="dz-grid dz-1-1" style={{ marginBottom: 18 }}>
        <Card title={t('chart.top')} subtitle="Ranking por ingresos generados">
          {loading ? <Skeleton h={220} /> : (
            <HBarChart sub format={moneyC} rows={(metrics?.topProducts ?? []).map((p) => ({ label: p.productName, value: Number(p.revenue), sub: `${p.unitsSold} u.` }))} />
          )}
        </Card>
        {isAdmin ? (
          <Card title={t('chart.branch')} subtitle="Comparativo de ingresos entre sucursales">
            {loading ? <Skeleton h={220} /> : (
              <ColumnChart format={moneyC} rows={(metrics?.salesByBranch ?? []).map((b) => ({ label: b.branchName, value: Number(b.totalAmount) }))} />
            )}
          </Card>
        ) : (
          <Card title="Operación de la sucursal" subtitle="Estado actual">
            {loading || !metrics ? <Skeleton h={220} /> : (
              <div className="dz-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <KpiCard label={t('kpi.cashiers')} value={num(metrics.activeCashiers)} icon={<Users size={16} />} />
                <KpiCard label="Reservas listas" value={num(metrics.resListas)} icon={<CalendarCheck size={16} />} tone="accent" />
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Temporada / Colección / Embudo */}
      <div className="dz-grid dz-1-1-1" style={{ marginBottom: 18 }}>
        <Card title={t('chart.season')}>
          {loading ? <Skeleton h={180} /> : <SimpleBars rows={(metrics?.salesBySeason ?? []).map((s) => ({ label: s.seasonName, value: Number(s.revenue) }))} format={moneyC} />}
        </Card>
        <Card title={t('chart.collection')}>
          {loading ? <Skeleton h={180} /> : <SimpleBars rows={(metrics?.salesByCollection ?? []).map((s) => ({ label: s.collectionName, value: Number(s.revenue) }))} format={moneyC} />}
        </Card>
        <Card title={t('chart.funnel')} subtitle="Pendiente → preparación → lista">
          {loading || !metrics ? <Skeleton h={180} /> : (
            <Funnel format={(v) => num(v)} steps={[
              { label: 'Activas', value: metrics.activeReservations },
              { label: 'Pendientes', value: metrics.resPendientes },
              { label: 'Confirmadas / prep.', value: metrics.resConfirmadasPreparando },
              { label: 'Listas p/ entregar', value: metrics.resListas },
            ]} />
          )}
        </Card>
      </div>

      <MlInsights />
    </div>
  );
};

const Slicer = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--atemporal-muted)' }}>
    {label}{children}
  </label>
);

const SimpleBars = ({ rows, format }: { rows: { label: string; value: number }[]; format: (v: number) => string }) => {
  if (!rows.length) return <Empty text="Sin ventas registradas" />;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.slice(0, 6).map((r, i) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontWeight: 700 }}>{format(r.value)}</span>
          </div>
          <div style={{ height: 8, background: 'var(--chart-track)', borderRadius: 5 }}>
            <div style={{ width: `${(r.value / total) * 100}%`, height: '100%', background: SERIES[i % SERIES.length], borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Panel de Machine Learning ── */
const MlInsights = () => {
  const { t, num, money } = useSettings();
  const { can, loading: planLoading } = usePlan();
  const enabled = can('ai');
  const [demand, setDemand] = useState<any>(null);
  const [segments, setSegments] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (planLoading || !enabled) return;
    setLoading(true);
    Promise.all([
      api.get('/analytics/demand-forecast', { params: { weeks: 12, horizon: 4 } }).then((r) => r.data),
      api.get('/analytics/customer-segments', { params: { k: 4 } }).then((r) => r.data),
    ])
      .then(([d, s]) => { setDemand(d); setSegments(s); })
      .catch((e) => setError(e.response?.data?.message || 'No se pudieron calcular los modelos'))
      .finally(() => setLoading(false));
  }, [enabled, planLoading]);

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--atemporal-green)', color: 'var(--atemporal-gold)' }}><BrainCircuit size={18} /></span>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{t('ml.title')}</h2>
        <p className="dz-sub">Modelos entrenados con el historial de ventas de tu empresa</p>
      </div>
    </div>
  );

  if (!enabled) {
    return (
      <section>
        {header}
        <div className="dz-grid dz-1-1-1">
          {[
            ['Pronóstico de demanda', 'Regresión lineal sobre ventas semanales para anticipar cuánto venderás de cada producto.'],
            ['Alertas de reposición', 'Calcula stock de seguridad y sugiere cuántas unidades reponer antes de un quiebre.'],
            ['Segmentación de clientes', 'K-Means sobre Recencia, Frecuencia y Monto (RFM) para campañas dirigidas.'],
          ].map(([title, desc]) => (
            <div key={title} className="dz-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <span className="sb-tag" style={{ position: 'absolute', top: 14, right: 14, fontSize: '0.6rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(201,144,74,0.16)', color: 'var(--atemporal-gold)' }}>PRO</span>
              <h3 style={{ marginBottom: 6 }}>{title}</h3>
              <p className="dz-sub" style={{ lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}><Link to="/pricing" className="dz-btn gold" style={{ textDecoration: 'none' }}><Sparkles size={15} /> Activar IA con el Plan Profesional</Link></div>
      </section>
    );
  }

  const risky = (demand?.products ?? [])
    .filter((p: any) => p.risk !== 'OK')
    .sort((a: any, b: any) => b.suggestedReorder - a.suggestedReorder)
    .slice(0, 5);
  const growing = (demand?.products ?? []).filter((p: any) => p.trend === 'CRECIENTE').length;
  const riskColor: Record<string, string> = { QUIEBRE: '#B91C1C', REPONER: '#B45309', OK: '#15803D' };

  return (
    <section>
      {header}
      {error && <div style={{ color: 'var(--atemporal-muted)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
      <div className="dz-grid dz-2-1">
        <Card title="Pronóstico de demanda · próximas 4 semanas" subtitle={demand?.model ?? 'Regresión lineal supervisada'}
          actions={<Link to="/dashboard/analytics" style={{ fontSize: '0.78rem', color: 'var(--atemporal-gold)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todo <ArrowRight size={13} /></Link>}>
          {loading ? <Skeleton h={220} /> : !demand?.products?.length ? <Empty text="Aún no hay ventas suficientes para entrenar el modelo" /> : (
            <>
              <div className="dz-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
                <MiniStat label="Productos analizados" value={num(demand.products.length)} />
                <MiniStat label="En riesgo de quiebre" value={num(demand.products.filter((p: any) => p.risk !== 'OK').length)} danger />
                <MiniStat label="Con tendencia al alza" value={num(growing)} />
              </div>
              {risky.length === 0 ? <Empty text="Ningún producto en riesgo: el stock cubre la demanda pronosticada" /> : (
                <div className="dz-scroll">
                  <table className="dz-table">
                    <thead><tr><th>Producto</th><th>Histórico → pronóstico</th><th className="r">Demanda</th><th className="r">Stock</th><th className="r">Reponer</th><th>Estado</th></tr></thead>
                    <tbody>
                      {risky.map((p: any) => (
                        <tr key={p.productId}>
                          <td style={{ fontWeight: 600 }}>{p.productName}</td>
                          <td><Sparkline history={p.history} forecast={p.forecast} /></td>
                          <td className="r">{num(p.forecastTotal)}</td>
                          <td className="r">{num(p.availableStock)}</td>
                          <td className="r" style={{ fontWeight: 800 }}>{num(p.suggestedReorder)}</td>
                          <td><span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, color: riskColor[p.risk], background: `${riskColor[p.risk]}18` }}>{p.risk}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
        <Card title="Segmentos de clientes" subtitle={segments?.model ?? 'K-Means sobre RFM (no supervisado)'}>
          {loading ? <Skeleton h={220} /> : !segments?.segments?.length ? <Empty text={segments?.message ?? 'Se necesitan más clientes con compras'} /> : (
            <>
              <DonutChart centerLabel="Clientes" format={(v) => num(v)} slices={segments.segments.map((s: any) => ({ label: s.name, value: s.size }))} />
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {segments.segments.slice(0, 3).map((s: any) => (
                  <div key={s.cluster} style={{ fontSize: '0.78rem', padding: '8px 10px', borderRadius: 9, background: 'var(--chart-track)' }}>
                    <b>{s.name}</b> · gasto medio {money(s.avgMonetary)}<br /><span style={{ color: 'var(--atemporal-muted)' }}>{s.suggestedAction}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </section>
  );
};

const MiniStat = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
  <div style={{ padding: '10px 12px', borderRadius: 11, background: 'var(--chart-track)' }}>
    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: danger ? '#B91C1C' : 'var(--atemporal-text)' }}>{value}</div>
    <div style={{ fontSize: '0.7rem', color: 'var(--atemporal-muted)', fontWeight: 600 }}>{label}</div>
  </div>
);
