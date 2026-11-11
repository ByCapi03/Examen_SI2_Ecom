export interface PlanInfo {
  id: number; code: string; name: string;
  priceMonthly: number | string; priceYearly: number | string;
  maxBranches: number; maxProducts: number | null; maxUsers: number | null;
  aiGenerativeReports: boolean;
}
export type Cycle = 'MONTHLY' | 'YEARLY';

export const money = (v: number | string) => `$${Number(v).toLocaleString('es-BO', { maximumFractionDigits: 2 })}`;
const SINGULAR: Record<string, string> = { sucursales: 'sucursal', productos: 'producto', 'usuarios internos': 'usuario interno' };
/** null = ilimitado; en sucursales 99 también cuenta como ilimitado. */
export const limitText = (n: number | null | undefined, unit: string) =>
  n == null || (unit === 'sucursales' && n >= 99) ? `${unit} ilimitados` : `${n} ${n === 1 ? (SINGULAR[unit] ?? unit) : unit}`;
export const price = (p: Pick<PlanInfo, 'priceMonthly' | 'priceYearly'>, c: Cycle) => Number(c === 'YEARLY' ? p.priceYearly : p.priceMonthly);
/** Ahorro del plan anual frente a pagar 12 meses. */
export const yearlySaving = (p: Pick<PlanInfo, 'priceMonthly' | 'priceYearly'>) => Math.max(0, Number(p.priceMonthly) * 12 - Number(p.priceYearly));
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export const STATUS_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  ACTIVE: { text: 'Activa', bg: '#dcfce7', fg: '#166534' },
  EXPIRED: { text: 'Vencida', bg: '#fef3c7', fg: '#92400e' },
  SUSPENDED: { text: 'Suspendida', bg: '#fee2e2', fg: '#991b1b' },
};
