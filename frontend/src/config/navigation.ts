import { ROL } from '../types/roles';
import type { Rol } from '../types/roles';
import type { PlanGateFeature } from '../features/saas/PlanContext';

export interface NavItem {
  /** Clave de traducción (ver SettingsContext). */
  key: string;
  path: string;
  allowedRoles: Rol[];
  feature?: PlanGateFeature;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

const MGMT = [ROL.ADMIN, ROL.ENCARGADO];

export const DASHBOARD_NAVIGATION: NavGroup[] = [
  {
    key: 'nav.general',
    items: [{ key: 'nav.dashboard', path: '/dashboard', allowedRoles: MGMT }],
  },
  {
    key: 'nav.operations',
    items: [
      { key: 'nav.pos', path: '/dashboard/pos', allowedRoles: [ROL.CAJERO] },
      { key: 'nav.sales', path: '/dashboard/sales', allowedRoles: MGMT },
      { key: 'nav.reservations', path: '/dashboard/reservations', allowedRoles: [ROL.ADMIN, ROL.ENCARGADO, ROL.CAJERO] },
      { key: 'nav.cash', path: '/dashboard/cash-sessions', allowedRoles: MGMT },
    ],
  },
  {
    key: 'nav.catalog',
    items: [
      { key: 'nav.products', path: '/dashboard/products', allowedRoles: MGMT },
      { key: 'nav.inventory', path: '/dashboard/inventory', allowedRoles: MGMT },
      { key: 'nav.suppliers', path: '/dashboard/suppliers', allowedRoles: [ROL.ADMIN] },
    ],
  },
  {
    key: 'nav.analysis',
    items: [
      { key: 'nav.reports', path: '/dashboard/reports', allowedRoles: MGMT, feature: 'reports' },
      { key: 'nav.aiReports', path: '/dashboard/ai-reports', allowedRoles: MGMT, feature: 'ai' },
      { key: 'nav.analytics', path: '/dashboard/analytics', allowedRoles: MGMT, feature: 'ai' },
    ],
  },
  {
    key: 'nav.admin',
    items: [
      { key: 'nav.branches', path: '/dashboard/branches', allowedRoles: [ROL.ADMIN] },
      { key: 'nav.users', path: '/dashboard/users', allowedRoles: MGMT },
      { key: 'nav.sync', path: '/dashboard/sync-conflicts', allowedRoles: MGMT },
      { key: 'nav.audit', path: '/dashboard/audit', allowedRoles: [ROL.ADMIN] },
      { key: 'nav.settings', path: '/dashboard/settings', allowedRoles: [ROL.ADMIN, ROL.ENCARGADO, ROL.CAJERO] },
    ],
  },
];
