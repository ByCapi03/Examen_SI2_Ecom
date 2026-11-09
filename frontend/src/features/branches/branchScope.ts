export interface BranchScope { id: number; name: string }

export const BRANCH_SCOPE_KEY = 'dressed.branchScope';

export const readBranchScope = (): BranchScope | null => {
  try {
    const raw = localStorage.getItem(BRANCH_SCOPE_KEY);
    return raw ? (JSON.parse(raw) as BranchScope) : null;
  } catch {
    return null;
  }
};

export const writeBranchScope = (scope: BranchScope | null) => {
  try {
    if (scope) localStorage.setItem(BRANCH_SCOPE_KEY, JSON.stringify(scope));
    else localStorage.removeItem(BRANCH_SCOPE_KEY);
  } catch { /* almacenamiento no disponible */ }
};
