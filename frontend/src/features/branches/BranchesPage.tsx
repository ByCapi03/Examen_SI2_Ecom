import { useAuth } from '../auth/AuthContext';
import { CitiesSection } from './CitiesSection';
import { BranchesSection } from './BranchesSection';
import { ROL } from '../../types/roles';
import { DashStyles, PageHeader, PlanBadge } from '../../components/dashboard/ui';
import '../../styles/admin.css';

export const BranchesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes(ROL.ADMIN);

  return (
    <div className="dz-page adm-scope">
      <DashStyles />
      <PageHeader
        title="Sucursales"
        subtitle={isAdmin
          ? 'Administra las ciudades y sucursales. Entra a una sucursal para gestionar sus ventas, inventario, reservas, cajas y personal.'
          : 'Administra la información de tu sucursal asignada'}
        badge={<PlanBadge />}
      />

      <div style={{ display: 'grid', gap: 18 }}>
        {isAdmin && <CitiesSection />}
        <BranchesSection />
      </div>
    </div>
  );
};
