import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Boxes, CalendarCheck, Sparkles, Wallet, Receipt, Hash, AlertTriangle } from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { usePlan } from '../saas/PlanContext';
import {
  DashStyles, PageHeader, PlanBadge, PlanGate, Card, KpiCard, AreaChart, DonutChart, HBarChart, ColumnChart, StackedBars, Skeleton, Empty,
} from '../../components/dashboard/ui';
import { CompanyThemeScope, useCompanyColor } from '../../components/dashboard/CompanyThemeScope';
import { ExportControl } from '../../components/dashboard/ExportControl';
import { loadExportOptions, type ExportDoc, type ExportFormat, type ExportTable } from '../ai-reports/exportOptions';

type Tab = 'sales' | 'products' | 'inventory' | 'reservations';

export const ReportsPage = () => {
  const { t } = useSettings();
  return (
    <div className="dz-page">
      <DashStyles />
      <CompanyThemeScope>
        <PageHeader title={t('rep.title')} subtitle={t('rep.subtitle')} badge={<PlanBadge />} />
        <PlanGate feature="reports" title="Reportes del negocio" bullets={[
          'Reporte de ventas por día y por método de pago',
          'Ranking de productos por unidades e ingresos',
          'Inventario por sucursal y alertas de stock bajo',
          'Estado de reservas por sucursal',
          'Filtros por fecha, sucursal y canal + descarga en PDF, Excel o CSV',
        ]}>
          <ReportsContent />
        </PlanGate>
      </CompanyThemeScope>
    </div>
  );
};

const ReportsContent = () => {
  const { user } = useAuth();
  const { t, money, num } = useSettings();
  const { can, tenant } = usePlan();
  const brand = useCompanyColor();
  const [exporting, setExporting] = useState(false);
  const isAdmin = !!user?.roles?.includes('ADMIN');

  const [tab, setTab] = useState<Tab>('sales');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [f, setF] = useState({ from: '', to: '', branchId: '', channel: '', paymentMethod: '' });
  // El resultado se guarda junto a su pestaña: así nunca se pinta una pestaña con datos de otra.
  const [result, setResult] = useState<{ tab: Tab; data: any } | null>(null);
  const data = result?.tab === tab ? result.data : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) api.get('/branches').then((r) => setBranches(r.data)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const params: Record<string, string> = {};
    Object.entries(f).forEach(([k, v]) => { if (v) params[k] = v; });
    let stale = false;
    setLoading(true);
    setError(null);
    api.get(`/reports/${tab}`, { params })
      .then((r) => { if (!stale) setResult({ tab, data: r.data }); })
      .catch((e) => { if (!stale) setError(e.response?.data?.message || 'Error al cargar el reporte'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [tab, f]);

  const moneyC = (v: number) => money(v, { compact: true });

  /** Documento exportable de la pestaña actual: los mismos datos que se ven en pantalla, con totales. */
  const buildDoc = (): ExportDoc | null => {
    if (!data) return null;
    const stamp = new Date().toISOString().slice(0, 10);
    const sum = (rows: (string | number)[][], c: number) => rows.reduce((a, r) => a + Number(r[c] ?? 0), 0);
    const branchName = f.branchId ? branches.find((b) => String(b.id) === f.branchId)?.name ?? `#${f.branchId}` : 'Todas las autorizadas';
    const context: [string, string][] = [
      ['Empresa', tenant?.name || '—'],
      ['Período', f.from || f.to ? `${f.from || 'inicio'} a ${f.to || 'hoy'}` : 'Todo el período'],
      ['Sucursal', branchName],
    ];
    if (tab === 'sales') {
      if (f.channel) context.push(['Canal', f.channel]);
      if (f.paymentMethod) context.push(['Método de pago', f.paymentMethod]);
    }
    if (user?.name) context.push(['Generado por', user.name]);

    let title = '';
    let table: ExportTable;
    if (tab === 'sales') {
      title = 'Reporte de ventas';
      context.push(['Total vendido', money(data.totalSalesAmount)], ['N° de ventas', num(data.salesCount)], ['Ticket promedio', money(data.averageTicket)], ['Unidades vendidas', num(data.unitsSold)]);
      const rows = data.salesByDay.map((d: any) => [d.date, Number(d.salesCount), Number(d.totalAmount), d.salesCount ? Math.round((Number(d.totalAmount) / Number(d.salesCount)) * 100) / 100 : 0]);
      table = { columns: ['Fecha', 'Ventas', 'Monto (Bs)', 'Ticket promedio (Bs)'], rows, totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 1) ? Math.round((sum(rows, 2) / sum(rows, 1)) * 100) / 100 : 0] };
    } else if (tab === 'products') {
      title = 'Reporte de productos';
      const rows = data.map((p: any) => [p.productName, Number(p.unitsSold), Number(p.revenue)]);
      table = { columns: ['Producto', 'Unidades', 'Ingresos (Bs)'], rows, totals: ['Total', sum(rows, 1), sum(rows, 2)] };
    } else if (tab === 'inventory') {
      title = 'Reporte de inventario';
      const rows = data.availabilityByBranch.map((b: any) => [b.branchName, Number(b.totalStock), Number(b.totalReserved), Number(b.totalAvailable)]);
      table = { columns: ['Sucursal', 'Stock', 'Reservado', 'Disponible'], rows, totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 3)] };
    } else {
      title = 'Reporte de reservas';
      const rows = data.byBranch.map((b: any) => [b.branchName, Number(b.total), Number(b.pending), Number(b.attended), Number(b.cancelled)]);
      table = { columns: ['Sucursal', 'Total', 'Activas', 'Atendidas', 'Canceladas'], rows, totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 3), sum(rows, 4)] };
    }
    context.unshift(['Reporte', title]);
    return { title, generatedAt: new Date().toISOString(), context, table, fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp}` };
  };

  const exportTab = async (format: ExportFormat) => {
    const doc = buildDoc();
    if (!doc) return;
    setExporting(true);
    setError(null);
    try {
      const { exportDocument } = await import('../ai-reports/exportReport');
      await exportDocument(doc, format, loadExportOptions(), { companyName: tenant?.name, userName: user?.name, color: brand.color });
    } catch {
      setError('No se pudo generar el archivo. Inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'sales', label: t('rep.sales'), icon: <ShoppingCart size={15} /> },
    { key: 'products', label: t('rep.products'), icon: <Package size={15} /> },
    { key: 'inventory', label: t('rep.inventory'), icon: <Boxes size={15} /> },
    { key: 'reservations', label: t('rep.reservations'), icon: <CalendarCheck size={15} /> },
  ];

  return (
    <>
      {/* Navegación + acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="dz-tabs">
          {tabs.map((x) => (
            <button key={x.key} className={`dz-tab${tab === x.key ? ' on' : ''}`} onClick={() => setTab(x.key)}>{x.icon}{x.label}</button>
          ))}
        </div>
        <ExportControl onExport={(fm) => void exportTab(fm)} disabled={!data} busy={exporting} />
      </div>

      {/* Filtros */}
      <div className="dz-card" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label={t('filters.from')}><input type="date" className="dz-input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label={t('filters.to')}><input type="date" className="dz-input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        {isAdmin && (
          <Field label={t('filters.branch')}>
            <select className="dz-input" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
              <option value="">{t('filters.all')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
        {tab === 'sales' && (
          <>
            <Field label={t('filters.channel')}>
              <select className="dz-input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
                <option value="">{t('filters.all')}</option><option value="POS">POS</option><option value="WEB">Web</option><option value="MOVIL">Móvil</option>
              </select>
            </Field>
            <Field label="Método de pago">
              <select className="dz-input" value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}>
                <option value="">{t('filters.all')}</option><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="QR">QR</option><option value="BILLETERA_MOVIL">Billetera móvil</option>
              </select>
            </Field>
          </>
        )}
        <button className="dz-btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setF({ from: '', to: '', branchId: '', channel: '', paymentMethod: '' })}>{t('filters.clear')}</button>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18 }}>{error}</div>}

      {loading || !data ? (
        <div className="dz-grid dz-kpis">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} />)}</div>
      ) : (
        <>
          {tab === 'sales' && (
            <>
              <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
                <KpiCard label="Total vendido" value={money(data.totalSalesAmount)} icon={<Wallet size={16} />} />
                <KpiCard label="N° de ventas" value={num(data.salesCount)} icon={<Hash size={16} />} />
                <KpiCard label="Ticket promedio" value={money(data.averageTicket)} icon={<Receipt size={16} />} tone="accent" />
                <KpiCard label="Unidades vendidas" value={num(data.unitsSold)} icon={<Package size={16} />} />
              </div>
              <div className="dz-grid dz-2-1" style={{ marginBottom: 18 }}>
                <Card title="Ventas por día" subtitle="Evolución del monto vendido">
                  <AreaChart format={moneyC} points={data.salesByDay.map((d: any) => ({ label: d.date.slice(5), value: Number(d.totalAmount) }))} />
                </Card>
                <Card title="Métodos de pago" subtitle="Distribución del monto cobrado">
                  <DonutChart format={moneyC} slices={data.salesByPaymentMethod.map((p: any) => ({ label: p.method, value: Number(p.totalAmount) }))} />
                </Card>
              </div>
              <Card title="Detalle diario">
                {data.salesByDay.length === 0 ? <Empty text={t('common.noData')} /> : (
                  <div className="dz-scroll">
                    <table className="dz-table">
                      <thead><tr><th>Fecha</th><th className="c">Ventas</th><th className="r">Monto</th><th className="r">Ticket prom.</th></tr></thead>
                      <tbody>{data.salesByDay.map((d: any) => (
                        <tr key={d.date}><td>{d.date}</td><td className="c">{d.salesCount}</td><td className="r" style={{ fontWeight: 700 }}>{money(d.totalAmount)}</td><td className="r">{money(d.salesCount ? d.totalAmount / d.salesCount : 0)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {tab === 'products' && (() => {
            const revenue = data.reduce((s: number, p: any) => s + Number(p.revenue), 0);
            const total = revenue || 1;
            return (
              <>
                <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
                  <KpiCard label="Productos vendidos" value={num(data.length)} icon={<Package size={16} />} />
                  <KpiCard label="Unidades totales" value={num(data.reduce((s: number, p: any) => s + Number(p.unitsSold), 0))} icon={<Hash size={16} />} />
                  <KpiCard label="Ingresos totales" value={money(revenue)} icon={<Wallet size={16} />} tone="accent" />
                </div>
                <div className="dz-grid dz-1-1">
                  <Card title="Top 10 por ingresos">
                    <HBarChart sub format={moneyC} rows={data.slice(0, 10).map((p: any) => ({ label: p.productName, value: Number(p.revenue), sub: `${p.unitsSold} u.` }))} />
                  </Card>
                  <Card title="Rendimiento por producto">
                    {data.length === 0 ? <Empty text={t('common.noData')} /> : (
                      <div className="dz-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
                        <table className="dz-table">
                          <thead><tr><th>Producto</th><th className="c">Unid.</th><th className="r">Ingresos</th><th className="r">% total</th></tr></thead>
                          <tbody>{data.map((p: any) => (
                            <tr key={p.productId}><td style={{ fontWeight: 600 }}>{p.productName}</td><td className="c">{p.unitsSold}</td><td className="r" style={{ fontWeight: 700 }}>{money(p.revenue)}</td><td className="r">{((Number(p.revenue) / total) * 100).toFixed(1)}%</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            );
          })()}

          {tab === 'inventory' && (() => {
            const sum = (k: string) => data.availabilityByBranch.reduce((s: number, b: any) => s + Number(b[k]), 0);
            return (
              <>
                <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
                  <KpiCard label="Stock total" value={num(sum('totalStock'))} icon={<Boxes size={16} />} />
                  <KpiCard label="Reservado" value={num(sum('totalReserved'))} icon={<CalendarCheck size={16} />} tone="accent" />
                  <KpiCard label="Disponible" value={num(sum('totalAvailable'))} icon={<Package size={16} />} />
                  <KpiCard label="Alertas de stock bajo" value={num(data.lowStock.length)} icon={<AlertTriangle size={16} />} tone={data.lowStock.length ? 'danger' : 'primary'} />
                </div>
                <div className="dz-grid dz-1-1">
                  <Card title="Disponibilidad por sucursal" subtitle="Unidades disponibles vs reservadas">
                    <StackedBars keys={['Disponible', 'Reservado']} format={(v) => `${num(v)} u.`}
                      rows={data.availabilityByBranch.map((b: any) => ({ label: b.branchName, values: [Number(b.totalAvailable), Number(b.totalReserved)] }))} />
                  </Card>
                  <Card title="Alertas de stock bajo" subtitle="Variantes por debajo del mínimo">
                    {data.lowStock.length === 0 ? <Empty text="Sin alertas: todas las variantes están sobre el mínimo" /> : (
                      <div className="dz-scroll" style={{ maxHeight: 360, overflowY: 'auto' }}>
                        <table className="dz-table">
                          <thead><tr><th>Producto</th><th>Variante</th><th>Sucursal</th><th className="c">Disp.</th><th className="c">Mín.</th></tr></thead>
                          <tbody>{data.lowStock.map((i: any) => (
                            <tr key={i.inventoryId}>
                              <td style={{ fontWeight: 600 }}>{i.productName}</td>
                              <td style={{ color: 'var(--atemporal-muted)' }}>{i.colorName} / {i.sizeName}</td>
                              <td>{i.branchName}</td>
                              <td className="c"><span style={{ fontWeight: 800, color: '#B91C1C' }}>{i.available}</span></td>
                              <td className="c">{i.stockMin}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            );
          })()}

          {tab === 'reservations' && (
            <>
              <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
                <KpiCard label="Total reservas" value={num(data.total)} icon={<CalendarCheck size={16} />} />
                <KpiCard label="Activas" value={num(data.pending)} icon={<CalendarCheck size={16} />} tone="accent" />
                <KpiCard label="Atendidas" value={num(data.attended)} icon={<CalendarCheck size={16} />} />
                <KpiCard label="Canceladas" value={num(data.cancelled)} icon={<AlertTriangle size={16} />} tone={data.cancelled ? 'danger' : 'primary'} />
              </div>
              <div className="dz-grid dz-1-1">
                <Card title="Estado de reservas">
                  <DonutChart format={(v) => num(v)} centerLabel="Reservas" slices={[
                    { label: 'Atendidas', value: data.attended }, { label: 'Activas', value: data.pending }, { label: 'Canceladas', value: data.cancelled },
                  ]} />
                </Card>
                <Card title="Reservas por sucursal">
                  <ColumnChart format={(v) => num(v)} rows={data.byBranch.map((b: any) => ({ label: b.branchName, value: b.total }))} />
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* Puente a reportes con IA */}
      <div className="dz-card" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'linear-gradient(120deg, var(--atemporal-green) 0%, var(--atemporal-green-dark) 100%)', color: '#fff', border: 'none' }}>
        <Sparkles size={22} color="var(--atemporal-gold)" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>¿Necesitas una respuesta específica?</b>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>Pregunta en lenguaje natural y la IA arma el reporte por ti{can('ai') ? '.' : ' (Plan Profesional).'}</div>
        </div>
        <Link to={can('ai') ? '/dashboard/ai-reports' : '/pricing'} className="dz-btn gold" style={{ textDecoration: 'none' }}>{can('ai') ? 'Ir a Reportes con IA' : 'Mejorar plan'}</Link>
      </div>
    </>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--atemporal-muted)' }}>
    {label}{children}
  </label>
);
