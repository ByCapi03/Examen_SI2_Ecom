import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import '../styles/dashboard.css';

export const DashboardLayout = () => {
  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--atemporal-cream)', overflow: 'hidden' }}>
      <DashboardSidebar />
      <div className="dashboard-content" style={{ flex: 1, padding: '0', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        <DashboardHeader />
        <main style={{ padding: '0 32px 32px 32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
