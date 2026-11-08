import { useAuth } from '../auth/AuthContext';
import { CitiesSection } from './CitiesSection';
import { BranchesSection } from './BranchesSection';
import { ROL } from '../../types/roles';

export const BranchesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes(ROL.ADMIN);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title">Sucursales</h1>
        <p className="page-subtitle">
          {isAdmin 
            ? 'Administra las ciudades y sucursales de la tienda' 
            : 'Administra la información de tu sucursal asignada'}
        </p>
      </div>

      {isAdmin && <CitiesSection />}
      <BranchesSection />
    </div>
  );
};
