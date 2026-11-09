import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readBranchScope, writeBranchScope } from './branchScope';
import type { BranchScope } from './branchScope';

interface Ctx {
  /** Sucursal en la que el ADMIN está "entrado"; null = vista de toda la empresa. */
  scope: BranchScope | null;
  enter: (branch: BranchScope) => void;
  exit: () => void;
}

const BranchScopeContext = createContext<Ctx | null>(null);

export const BranchScopeProvider = ({ children }: { children: ReactNode }) => {
  const [scope, setScope] = useState<BranchScope | null>(readBranchScope);

  const value = useMemo<Ctx>(() => ({
    scope,
    enter: (branch) => { writeBranchScope(branch); setScope(branch); },
    exit: () => { writeBranchScope(null); setScope(null); },
  }), [scope]);

  return <BranchScopeContext.Provider value={value}>{children}</BranchScopeContext.Provider>;
};

export const useBranchScope = () => {
  const ctx = useContext(BranchScopeContext);
  if (!ctx) throw new Error('useBranchScope debe usarse dentro de BranchScopeProvider');
  return ctx;
};
