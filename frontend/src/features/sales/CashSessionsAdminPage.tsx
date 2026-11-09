import { DashStyles, PageHeader, PlanBadge } from '../../components/dashboard/ui';
import { CashSessionsView } from './CashSessionsView';

export const CashSessionsAdminPage = () => (
  <div className="dz-page">
    <DashStyles />
    <PageHeader
      title="Sesiones de caja"
      subtitle="Abre cajas para tus cajeros, cierra las pendientes y revisa diferencias"
      badge={<PlanBadge />}
    />
    <CashSessionsView />
  </div>
);
