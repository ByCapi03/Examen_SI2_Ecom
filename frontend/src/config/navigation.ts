import { ROL } from '../types/roles';
import type { Rol } from '../types/roles';

export interface NavItem {
  name: string;
  path: string;
  allowedRoles: Rol[];
  icon?: string;
}

export const DASHBOARD_NAVIGATION: NavItem[] = [
  {
    name: 'Inicio',
    path: '/dashboard',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },
  {
    name: 'Productos',
    path: '/dashboard/products',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },

  {
    name: 'Inventario',
    path: '/dashboard/inventory',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },
  {
    name: 'Reservas',
    path: '/dashboard/reservations',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO, ROL.CAJERO],
  },
  {
    name: 'Ventas',
    path: '/dashboard/sales',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },
  {
    name: 'Punto de Venta',
    path: '/dashboard/pos',
    allowedRoles: [ROL.CAJERO],
  },
  {
    name: 'Sucursales',
    path: '/dashboard/branches',
    allowedRoles: [ROL.ADMIN],
  },
  {
    name: 'Usuarios / Cajeros',
    path: '/dashboard/users',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },
  {
    name: 'Sesiones de Caja',
    path: '/dashboard/cash-sessions',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },
  {
    name: 'Reportes',
    path: '/dashboard/reports',
    allowedRoles: [ROL.ADMIN, ROL.ENCARGADO],
  },
  {
    name: 'Proveedores',
    path: '/dashboard/suppliers',
    allowedRoles: [ROL.ADMIN],
  }
];
