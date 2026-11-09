import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  LogOut, LayoutDashboard, Calendar, Box, Package, Users, ShoppingCart, DollarSign, Store,
  BarChart3, Sparkles, BrainCircuit, Truck, Building2, RefreshCcw, Settings, Lock,
} from 'lucide-react';
import { DASHBOARD_NAVIGATION } from '../config/navigation';
import { useAuth } from '../features/auth/AuthContext';
import { usePlan } from '../features/saas/PlanContext';
import { useSettings } from '../config/SettingsContext';

const ICONS: Record<string, ReactNode> = {
  '/dashboard': <LayoutDashboard size={18} />,
  '/dashboard/pos': <Store size={18} />,
  '/dashboard/sales': <ShoppingCart size={18} />,
  '/dashboard/reservations': <Calendar size={18} />,
  '/dashboard/cash-sessions': <DollarSign size={18} />,
  '/dashboard/products': <Package size={18} />,
  '/dashboard/inventory': <Box size={18} />,
  '/dashboard/suppliers': <Truck size={18} />,
  '/dashboard/reports': <BarChart3 size={18} />,
  '/dashboard/ai-reports': <Sparkles size={18} />,
  '/dashboard/analytics': <BrainCircuit size={18} />,
  '/dashboard/branches': <Building2 size={18} />,
  '/dashboard/users': <Users size={18} />,
  '/dashboard/sync-conflicts': <RefreshCcw size={18} />,
  '/dashboard/settings': <Settings size={18} />,
};

export const DashboardSidebar = ({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) => {
  const { user, logout } = useAuth();
  const { tenant, can } = usePlan();
  const { t, settings } = useSettings();
  const navigate = useNavigate();
  const compact = settings.compactSidebar;

  const groups = DASHBOARD_NAVIGATION
    .map((g) => ({ ...g, items: g.items.filter((i) => user?.roles?.some((r) => i.allowedRoles.includes(r as any))) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className={`dashboard-sidebar${open ? ' open' : ''}`} style={{ width: compact ? 78 : 264, padding: '22px 0 16px', height: '100vh', position: 'sticky', top: 0, flexShrink: 0, transition: 'width .2s' }}>
      <style>{`
        .sb-nav { flex: 1; overflow-y: auto; padding: 0 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
        .sb-group { margin-bottom: 14px; }
        .sb-group-title { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(245,242,235,0.35); padding: 0 12px 6px; }
        .sb-link { display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 10px; color: rgba(245,242,235,0.72); text-decoration: none; font-size: 0.87rem; font-weight: 500; transition: background .15s, color .15s; position: relative; }
        .sb-link:hover { background: rgba(245,242,235,0.06); color: #fff; }
        .sb-link.active { background: var(--atemporal-green-soft); color: #fff; box-shadow: inset 3px 0 0 var(--atemporal-gold); }
        .sb-link.active svg { color: var(--atemporal-gold); }
        .sb-link.locked { color: rgba(245,242,235,0.42); }
        .sb-tag { margin-left: auto; font-size: 0.56rem; font-weight: 800; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 6px; background: rgba(201,144,74,0.18); color: var(--atemporal-gold); display: inline-flex; align-items: center; gap: 3px; }
        .sb-compact .sb-link { justify-content: center; padding: 11px 0; }
        .sb-compact .sb-label, .sb-compact .sb-tag, .sb-compact .sb-group-title { display: none; }
      `}</style>

      <div className={compact ? 'sb-compact' : ''} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: compact ? '0 0 18px' : '0 24px 18px', textAlign: compact ? 'center' : 'left', borderBottom: '1px solid rgba(245,242,235,0.08)', marginBottom: 16 }}>
          <div style={{ fontSize: compact ? '0.95rem' : '1.45rem', fontWeight: 900, letterSpacing: '0.12em', color: 'var(--atemporal-gold)' }}>
            {compact ? 'D' : 'DRESSED'}
          </div>
          {!compact && tenant && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</div>
              {tenant.plan && (
                <span style={{ display: 'inline-block', marginTop: 5, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'rgba(201,144,74,0.16)', color: 'var(--atemporal-gold)' }}>
                  {tenant.plan.name}
                </span>
              )}
            </div>
          )}
        </div>

        <nav className="sb-nav">
          {groups.map((g) => (
            <div key={g.key} className="sb-group">
              <div className="sb-group-title">{t(g.key)}</div>
              {g.items.map((item) => {
                const locked = item.feature ? !can(item.feature) : false;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/dashboard'}
                    title={t(item.key)}
                    onClick={onNavigate}
                    className={({ isActive }) => `sb-link${isActive ? ' active' : ''}${locked ? ' locked' : ''}`}
                  >
                    {ICONS[item.path]}
                    <span className="sb-label">{t(item.key)}</span>
                    {locked && <span className="sb-tag"><Lock size={9} />{item.feature === 'ai' ? 'PRO' : 'STARTER'}</span>}
                    {!locked && item.feature === 'ai' && <span className="sb-tag">IA</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 12px 0', borderTop: '1px solid rgba(245,242,235,0.08)' }}>
          <button
            onClick={() => { onNavigate?.(); logout(); navigate('/login'); }}
            className="sb-link"
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            title={t('nav.logout')}
          >
            <LogOut size={18} />
            <span className="sb-label">{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
