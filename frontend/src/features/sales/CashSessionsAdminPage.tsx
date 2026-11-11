import { DashStyles, PageHeader, PlanBadge } from '../../components/dashboard/ui';
import { CashSessionsView } from './CashSessionsView';

export const CashSessionsAdminPage = () => (
  <div className="dz-page">
    <DashStyles />
    <PageHeader
      title="Sesiones de caja"
      subtitle="Crea las cajas de tus sucursales, ábrelas con tus cajeros y revisa los turnos y sus diferencias"
      badge={<PlanBadge />}
    />
    <CashSessionsView />
  </div>
);
