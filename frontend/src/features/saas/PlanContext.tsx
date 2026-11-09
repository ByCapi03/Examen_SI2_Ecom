import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';

export type PlanCode = 'BASICO' | 'STARTER' | 'PROFESIONAL' | 'EMPRESARIAL';
export type PlanGateFeature = 'reports' | 'ai';

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  plan: { code: PlanCode; name: string; aiGenerativeReports: boolean; maxBranches: number } | null;
}

interface Ctx {
  tenant: TenantInfo | null;
  loading: boolean;
  /** Si el plan aún no se conoce devuelve true y el backend decide. */
  can: (feature: PlanGateFeature) => boolean;
  requiredPlanFor: (feature: PlanGateFeature) => string;
}

const PlanContext = createContext<Ctx | null>(null);
const STAFF = ['ADMIN', 'ENCARGADO', 'CAJERO'];

export const PlanProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const isStaff = !!user?.roles?.some((r) => STAFF.includes(r));

  useEffect(() => {
    if (!isAuthenticated || !isStaff) { setTenant(null); return; }
    setLoading(true);
    api.get('/saas/tenants/me')
      .then((r) => setTenant(r.data))
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated, isStaff, user?.id]);

  const can = (feature: PlanGateFeature) => {
    const plan = tenant?.plan;
    if (!plan) return true;
    if (feature === 'reports') return plan.code !== 'BASICO';
    return !!plan.aiGenerativeReports;
  };

  return (
    <PlanContext.Provider value={{
      tenant, loading, can,
      requiredPlanFor: (f) => (f === 'reports' ? 'Starter' : 'Profesional'),
    }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan debe usarse dentro de PlanProvider');
  return ctx;
};
