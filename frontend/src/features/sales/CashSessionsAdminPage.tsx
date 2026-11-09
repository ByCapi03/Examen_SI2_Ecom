import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Unlock, Lock, Scale, RefreshCw, Building2, UserPlus, Store, ChevronRight } from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { DashStyles, PageHeader, PlanBadge, Card, KpiCard, Empty, Skeleton } from '../../components/dashboard/ui';

interface CashSession {
  id: number;
  cashierName: string;
  branchName: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
}

type Filter = 'ALL' | 'OPEN' | 'CLOSED';

export const CashSessionsAdminPage = () => {
  const { user } = useAuth();
  const { money, locale } = useSettings();
  const isAdmin = !!user?.roles?.includes('ADMIN');

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/cash-sessions');
      setSessions(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar las sesiones de caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchSessions(); }, []);

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

  const steps: { icon: React.ReactNode; title: string; text: string; to?: string; cta?: string }[] = [
    ...(isAdmin
      ? [{ icon: <Building2 size={18} />, title: 'Crea una sucursal', text: 'Cada caja pertenece a una sucursal de tu empresa.', to: '/dashboard/branches', cta: 'Ir a Sucursales' }]
      : []),
    { icon: <UserPlus size={18} />, title: 'Crea un usuario con rol Cajero', text: 'Asígnale su sucursal. Solo los cajeros pueden abrir y cerrar caja.', to: '/dashboard/users', cta: 'Ir a Usuarios' },
    { icon: <Store size={18} />, title: 'El cajero abre su caja', text: 'Inicia sesión, entra a Punto de venta e ingresa el monto inicial. Cada turno aparecerá aquí.' },
  ];

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Todas', count: sessions.length },
    { key: 'OPEN', label: 'Abiertas', count: stats.open },
    { key: 'CLOSED', label: 'Cerradas', count: stats.closed },
  ];

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader
        title="Sesiones de caja"
        subtitle="Turnos de caja abiertos por los cajeros: aperturas, cierres y diferencias"
        badge={<PlanBadge />}
        actions={<button className="dz-btn ghost" onClick={() => void fetchSessions()}><RefreshCw size={15} /> Actualizar</button>}
      />

      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18 }}>{error}</div>}

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

      {!loading && sessions.length === 0 ? (
        <Card title="Aún no hay sesiones de caja" subtitle="Las cajas las abre cada cajero desde el Punto de venta. Así empiezas:">
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {steps.map((s, i) => (
              <li key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, border: '1px solid var(--atemporal-border)', borderRadius: 14, flexWrap: 'wrap' }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--atemporal-green)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    <span style={{ color: 'var(--atemporal-gold)', marginRight: 6 }}>{i + 1}.</span>{s.title}
                  </div>
                  <div className="dz-sub" style={{ marginTop: 3 }}>{s.text}</div>
                </div>
                {s.to && <Link to={s.to} className="dz-btn ghost" style={{ textDecoration: 'none' }}>{s.cta} <ChevronRight size={14} /></Link>}
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card
          title="Historial de turnos"
          subtitle="Las cajas se abren desde Punto de venta por cada cajero"
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
          {loading ? <Skeleton h={220} /> : visible.length === 0 ? <Empty text="No hay sesiones con este estado" /> : (
            <div className="dz-scroll">
              <table className="dz-table">
                <thead>
                  <tr>
                    <th>Cajero</th><th>Sucursal</th><th>Apertura</th><th className="r">Monto inicial</th>
                    <th>Cierre</th><th className="r">Esperado</th><th className="r">Monto de cierre</th><th className="r">Diferencia</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.cashierName}</td>
                      <td>{s.branchName || '—'}</td>
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
                        }}>
                          {s.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
