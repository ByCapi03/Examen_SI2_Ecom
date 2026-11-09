import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Phone, ShoppingCart, Boxes, CalendarCheck, Users, BarChart3, LayoutDashboard, Wallet, Receipt, AlertTriangle, UserCog,
} from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { usePlan } from '../saas/PlanContext';
import { useBranchScope } from './BranchScopeContext';
import { DashStyles, PageHeader, PlanBadge, Card, KpiCard, Skeleton, Empty } from '../../components/dashboard/ui';
import { CashSessionsView } from '../sales/CashSessionsView';

interface Branch { id: number; name: string; address: string; phone: string; active: boolean; city?: { name: string } }
interface StaffUser { id: number; name: string; email: string; active: boolean; userRoles?: { active: boolean; role: { name: string } }[] }

const ROLE_LABEL: Record<string, string> = { ENCARGADO: 'Encargado', CAJERO: 'Cajero', ADMIN: 'Administrador' };

/**
 * Panel de una sucursal: lo que el ENCARGADO ve siempre, y a lo que el ADMIN "entra".
 * Al entrar, ventas, inventario, reservas, cajas y usuarios quedan limitados a esta sucursal.
 */
export const BranchWorkspacePage = ({ own = false }: { own?: boolean }) => {
  const { user } = useAuth();
  const { money, num } = useSettings();
  const { can } = usePlan();
  const { scope, enter, exit } = useBranchScope();
  const params = useParams();
  const isAdmin = !!user?.roles?.includes('ADMIN');

  const requestedId = own ? user?.branchId : Number(params.id);
  const branchId = isAdmin ? requestedId : user?.branchId; // el encargado solo ve la suya

  const [branch, setBranch] = useState<Branch | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
    let stale = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/branches').then((r) => (r.data as Branch[]).find((b) => b.id === branchId) ?? null),
      api.get('/dashboard/metrics', { params: { branchId } }).then((r) => r.data).catch(() => null),
      api.get('/users', { params: { branchId } }).then((r) => r.data as StaffUser[]).catch(() => []),
    ]).then(([b, m, u]) => {
      if (stale) return;
      if (!b) { setError('La sucursal no existe o no tienes acceso a ella.'); return; }
      setBranch(b); setMetrics(m); setStaff(u);
      if (isAdmin && scope?.id !== b.id) enter({ id: b.id, name: b.name });
    }).catch((e) => { if (!stale) setError(e.response?.data?.message ?? 'No se pudo cargar la sucursal'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  if (!own && !isAdmin && user?.branchId && Number(params.id) !== user.branchId) return <Navigate to="/dashboard/my-branch" replace />;
  if (!branchId) return <div className="dz-page"><DashStyles /><Empty text="Tu usuario no tiene una sucursal asignada." /></div>;

  const shortcuts = [
    { to: '/dashboard', icon: <LayoutDashboard size={18} />, title: 'Dashboard', text: 'Indicadores de la sucursal' },
    { to: '/dashboard/sales', icon: <ShoppingCart size={18} />, title: 'Ventas', text: 'Ventas registradas aquí' },
    { to: '/dashboard/inventory', icon: <Boxes size={18} />, title: 'Inventario', text: 'Stock y movimientos' },
    { to: '/dashboard/reservations', icon: <CalendarCheck size={18} />, title: 'Reservas', text: 'Reservas para recoger' },
    { to: '/dashboard/users', icon: <Users size={18} />, title: 'Usuarios', text: 'Cajeros de la sucursal' },
    ...(can('reports') ? [{ to: '/dashboard/reports', icon: <BarChart3 size={18} />, title: 'Reportes', text: 'Análisis de la sucursal' }] : []),
  ];

  return (
    <div className="dz-page">
      <DashStyles />
      {isAdmin && (
        <Link to="/dashboard/branches" onClick={() => exit()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--atemporal-muted)', textDecoration: 'none', fontSize: '0.82rem', marginBottom: 10 }}>
          <ArrowLeft size={14} /> Todas las sucursales
        </Link>
      )}
      <PageHeader
        title={branch?.name ?? 'Sucursal'}
        subtitle={branch?.city?.name}
        badge={<>{branch && <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: branch.active ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.12)', color: branch.active ? '#15803D' : '#B91C1C' }}>{branch.active ? 'ACTIVA' : 'INACTIVA'}</span>}<PlanBadge /></>}
      />
      {branch && <p className="dz-sub" style={{ margin: '-12px 0 16px', display: 'flex', gap: 14, flexWrap: 'wrap' }}><span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><MapPin size={13} />{branch.address}</span>{branch.phone && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Phone size={13} />{branch.phone}</span>}</p>}

      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18 }}>{error}</div>}

      <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} />) : metrics && (
          <>
            <KpiCard label="Ventas de hoy" value={money(metrics.salesTodayAmount)} icon={<Wallet size={16} />} />
            <KpiCard label="Transacciones hoy" value={num(metrics.salesTodayCount)} icon={<Receipt size={16} />} />
            <KpiCard label="Reservas activas" value={num(metrics.activeReservations)} icon={<CalendarCheck size={16} />} tone="accent" />
            <KpiCard label="Alertas de stock" value={num(metrics.lowStockCount)} icon={<AlertTriangle size={16} />} tone={metrics.lowStockCount > 0 ? 'danger' : 'primary'} />
          </>
        )}
      </div>

      <div className="dz-grid dz-1-1-1" style={{ marginBottom: 18 }}>
        {shortcuts.map((s) => (
          <Link key={s.to} to={s.to} className="dz-card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 12, alignItems: 'center', padding: 16 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--atemporal-green)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{s.icon}</span>
            <span><b style={{ display: 'block', fontSize: '0.92rem' }}>{s.title}</b><span className="dz-sub">{s.text}</span></span>
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 800 }}>Cajas de la sucursal</h2>
        <CashSessionsView branchId={branchId} embedded />
      </div>

      <Card title="Personal de la sucursal" subtitle="Encargados y cajeros asignados a esta sucursal"
        actions={<Link to="/dashboard/users" className="dz-btn ghost" style={{ textDecoration: 'none' }}><UserCog size={15} /> Gestionar</Link>}>
        {loading ? <Skeleton h={90} /> : staff.length === 0 ? <Empty text="Aún no hay personal asignado a esta sucursal" /> : (
          <div className="dz-scroll">
            <table className="dz-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{(u.userRoles ?? []).filter((r) => r.active).map((r) => ROLE_LABEL[r.role.name] ?? r.role.name).join(', ') || '—'}</td>
                    <td><span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: u.active ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.12)', color: u.active ? '#15803D' : '#B91C1C' }}>{u.active ? 'ACTIVO' : 'INACTIVO'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
