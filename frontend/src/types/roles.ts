export const ROL = {
  ADMIN: 'ADMIN',
  CLIENTE: 'CLIENTE',
  ENCARGADO: 'ENCARGADO',
  CAJERO: 'CAJERO',
  SUPERADMIN: 'SUPERADMIN',
} as const;

export type Rol = typeof ROL[keyof typeof ROL];
