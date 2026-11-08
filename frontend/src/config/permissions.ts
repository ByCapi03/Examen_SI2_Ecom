import { ROL } from '../types/roles';
import type { Rol } from '../types/roles';

export const PERMISSIONS = {
  MANAGE_PRODUCTS: [ROL.ADMIN, ROL.ENCARGADO],
  VIEW_PRODUCTS: [ROL.ADMIN, ROL.ENCARGADO, ROL.CAJERO, ROL.CLIENTE],
  
  MANAGE_INVENTORY_GLOBAL: [ROL.ADMIN],
  MANAGE_INVENTORY_BRANCH: [ROL.ENCARGADO],
  
  MANAGE_BRANCHES: [ROL.ADMIN],
  
  VIEW_RESERVATIONS: [ROL.ADMIN, ROL.ENCARGADO],
  CREATE_RESERVATIONS: [ROL.CLIENTE],
  
  VIEW_SALES_GLOBAL: [ROL.ADMIN],
  VIEW_SALES_BRANCH: [ROL.ENCARGADO],
  REGISTER_POS_SALE: [ROL.CAJERO],
  
  MANAGE_USERS: [ROL.ADMIN],
  MANAGE_SUPPLIERS: [ROL.ADMIN],
  
  VIEW_REPORTS: [ROL.ADMIN],
};

export const hasPermission = (userRoles: Rol[] = [], requiredRoles: Rol[]) => {
  return userRoles.some(role => requiredRoles.includes(role));
};
