import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, LogOut } from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useBranchScope } from './BranchScopeContext';

/** Aviso permanente de en qué sucursal se está trabajando (ADMIN "entrado" o ENCARGADO). */
export const BranchBanner = () => {
  const { user } = useAuth();
  const { scope, exit } = useBranchScope();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inPanel = pathname.startsWith('/dashboard/branches/') || pathname === '/dashboard/my-branch';
  const isAdmin = !!user?.roles?.includes('ADMIN');
  const isEncargado = !isAdmin && !!user?.roles?.includes('ENCARGADO');
  const [ownName, setOwnName] = useState<string | null>(null);

  useEffect(() => {
    if (!isEncargado || !user?.branchId) return;
    api.get('/branches')
      .then((r) => setOwnName((r.data as { id: number; name: string }[]).find((b) => b.id === user.branchId)?.name ?? null))
      .catch(() => {});
  }, [isEncargado, user?.branchId]);

  const name = isAdmin ? scope?.name : isEncargado ? ownName : null;
  const id = isAdmin ? scope?.id : user?.branchId;
  if (!name || !id) return null;

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 6px', padding: '10px 14px',
      borderRadius: 12, background: 'var(--atemporal-green)', color: '#fff', fontSize: '0.84rem',
    }}>
      <Building2 size={16} color="var(--atemporal-gold)" />
      <span style={{ flex: 1, minWidth: 200 }}>
        {isAdmin ? 'Gestionando la sucursal' : 'Tu sucursal'} <b>{name}</b>
        {isAdmin && <span style={{ opacity: 0.65 }}> · ventas, inventario, reservas, cajas y usuarios se limitan a esta sucursal</span>}
      </span>
      {!inPanel && <Link to={isAdmin ? `/dashboard/branches/${id}` : '/dashboard/my-branch'} style={{ color: 'var(--atemporal-gold)', fontWeight: 700, textDecoration: 'none' }}>Panel de la sucursal</Link>}
      {isAdmin && (
        <button onClick={() => { exit(); navigate('/dashboard/branches'); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
          <LogOut size={13} /> Salir de la sucursal
        </button>
      )}
    </div>
  );
};
