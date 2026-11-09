import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import '../styles/dashboard.css';
import { BranchBanner } from '../features/branches/BranchBanner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { OfflineStatusBar } from '../components/common/OfflineStatusBar';

export const DashboardLayout = () => {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setNavOpen(false); }, [pathname]);

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--atemporal-cream)', overflow: 'hidden' }}>
      <style>{`
        .dash-mobilebar, .dash-overlay { display: none; }
        @media (max-width: 900px) {
          .dashboard-sidebar { position: fixed !important; left: 0; top: 0; bottom: 0; height: 100vh !important; width: 264px !important; transform: translateX(-104%); transition: transform .25s ease; z-index: 60; }
          .dashboard-sidebar.open { transform: none; box-shadow: 0 0 40px rgba(0,0,0,.45); }
          .dashboard-sidebar .sb-compact .sb-label { display: inline !important; }
          .dashboard-sidebar .sb-compact .sb-tag { display: inline-flex !important; }
          .dashboard-sidebar .sb-compact .sb-group-title { display: block !important; }
          .dashboard-sidebar .sb-compact .sb-link { justify-content: flex-start !important; padding: 9px 12px !important; }
          .dash-overlay.show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 55; }
          .dash-mobilebar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; position: sticky; top: 0; z-index: 40; background: var(--atemporal-green); color: #fff; }
          .dash-mobilebar button { background: transparent; border: 1px solid rgba(255,255,255,.25); color: #fff; border-radius: 10px; width: 40px; height: 40px; display: grid; place-items: center; cursor: pointer; }
          .dashboard-main { padding: 0 16px 24px !important; }
        }
      `}</style>

      <DashboardSidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      <div className={`dash-overlay${navOpen ? ' show' : ''}`} onClick={() => setNavOpen(false)} />

      <div className="dashboard-content" style={{ flex: 1, minWidth: 0, padding: '0', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        <div className="dash-mobilebar">
          <button aria-label="Abrir menú" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <strong style={{ letterSpacing: '0.12em', color: 'var(--atemporal-gold)' }}>DRESSED</strong>
        </div>
        <DashboardHeader />
        <main className="dashboard-main" style={{ padding: '0 32px 32px 32px' }}>
          <BranchBanner />
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <OfflineStatusBar />
      </div>
    </div>
  );
};
