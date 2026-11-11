import { useEffect, useState } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';

/** Nombre de la sucursal del encargado/cajero (el administrador no pertenece a una sucursal). */
export const useMyBranchName = () => {
  const { user } = useAuth();
  const branchId = user?.roles?.includes('ADMIN') ? null : user?.branchId ?? null;
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) { setName(null); return; }
    let stale = false;
    api.get('/branches')
      .then((r) => { if (!stale) setName((r.data as { id: number; name: string }[]).find((b) => b.id === branchId)?.name ?? null); })
      .catch(() => {});
    return () => { stale = true; };
  }, [branchId]);

  return name;
};
