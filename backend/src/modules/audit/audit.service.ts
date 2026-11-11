/**
 * AUDIT SERVICE
 * Registra eventos sin bloquear nunca la petición original y consulta la bitácora (solo ADMIN).
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export const ENTITY_LABELS: Record<string, string> = {
  products: 'Productos', variants: 'Variantes', categories: 'Categorías', sizes: 'Tallas', colors: 'Colores',
  seasons: 'Temporadas', collections: 'Colecciones', promotions: 'Promociones', inventory: 'Inventario',
  suppliers: 'Proveedores', sales: 'Ventas', pos: 'Punto de venta', reservations: 'Reservas', payments: 'Pagos',
  'cash-sessions': 'Turnos de caja', 'cash-registers': 'Cajas', branches: 'Sucursales', cities: 'Ciudades',
  users: 'Usuarios', roles: 'Roles', clients: 'Clientes', tenants: 'Empresa', auth: 'Acceso',
  'ai-reports': 'Reportes con IA', analytics: 'Analítica',
};

export const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión', LOGIN_FAILED: 'Acceso fallido', DENIED: 'Acción denegada',
  CREATE: 'Creación', UPDATE: 'Modificación', DELETE: 'Eliminación',
  CASH_OPEN: 'Apertura de caja', CASH_CLOSE: 'Cierre de caja', STOCK_MOVEMENT: 'Movimiento de stock',
  PASSWORD_RESET: 'Contraseña temporal', TENANT_REGISTER: 'Alta de empresa', EMAIL_VERIFIED: 'Correo verificado',
};

const SENSITIVE_KEY = /pass|token|secret|cvc|cvv|card|authorization|^code$/i;
const MAX_DETAILS = 4000;

/** Oculta contraseñas, tokens, tarjetas y códigos antes de guardar o mostrar datos. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return typeof value === 'string' && value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (depth > 4) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 40)
      .map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? '[oculto]' : redact(v, depth + 1)]),
  );
}

export interface AuditEntry {
  tenantId: number;
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  userRoles?: string[] | null;
  branchId?: number | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  summary: string;
  body?: unknown;
  method: string;
  path: string;
  statusCode: number;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditQuery {
  from?: string; to?: string; userId?: string; action?: string; entity?: string; q?: string; page?: string; limit?: string;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');
const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita inyección de fórmulas al abrir en Excel
  return `"${s.replace(/"/g, '""')}"`;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly names = new Map<number, string>();

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  /** Usuario por id o correo, con su empresa y roles activos. */
  async lookupUser(by: { id?: number; email?: string }) {
    const rows = await this.dataSource.query(
      `SELECT u.id, u.name, u.email, u."tenantId", u."branchId",
              COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur."userId" = u.id AND ur.active = true
         LEFT JOIN roles r ON r.id = ur."roleId"
        WHERE ${by.id ? 'u.id = $1' : 'LOWER(u.email) = LOWER($1)'}
        GROUP BY u.id LIMIT 1`,
      [by.id ?? by.email],
    );
    return rows[0] as { id: number; name: string; email: string; tenantId: number; branchId: number | null; roles: string[] } | undefined;
  }

  private async resolveName(userId: number): Promise<string | null> {
    const cached = this.names.get(userId);
    if (cached) return cached;
    const user = await this.lookupUser({ id: userId });
    if (user?.name) {
      if (this.names.size > 500) this.names.clear();
      this.names.set(userId, user.name);
    }
    return user?.name ?? null;
  }

  /** Nunca lanza: un fallo de la bitácora no debe afectar la operación del usuario. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const userName = entry.userName ?? (entry.userId ? await this.resolveName(entry.userId) : null);
      let details: string | null = null;
      if (entry.body && typeof entry.body === 'object' && Object.keys(entry.body as object).length) {
        details = JSON.stringify(redact(entry.body));
        if (details.length > MAX_DETAILS) details = JSON.stringify({ _truncado: true, vista_previa: details.slice(0, MAX_DETAILS - 60) });
      }
      await this.repo.save(this.repo.create({
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        userName,
        userEmail: entry.userEmail ?? null,
        userRoles: entry.userRoles?.length ? entry.userRoles.join(',') : null,
        branchId: entry.branchId ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId !== undefined && entry.entityId !== null ? String(entry.entityId) : null,
        summary: entry.summary.slice(0, 500),
        details,
        method: entry.method,
        path: entry.path.slice(0, 300),
        statusCode: entry.statusCode,
        ip: entry.ip?.slice(0, 64) ?? null,
        userAgent: entry.userAgent?.slice(0, 200) ?? null,
      }));
    } catch (err) {
      this.logger.warn(`No se pudo registrar el evento de bitácora: ${(err as Error).message}`);
    }
  }

  private assertAdmin(actor: any) {
    if (!actor?.roles?.includes('ADMIN')) throw new ForbiddenException('Solo el administrador puede consultar la bitácora');
  }

  private buildQuery(actor: any, q: AuditQuery) {
    const qb = this.repo.createQueryBuilder('a').where('a.tenantId = :tenantId', { tenantId: actor.tenantId });
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) qb.andWhere('a.createdAt >= :from', { from: new Date(`${q.from}T00:00:00`) });
    if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) qb.andWhere('a.createdAt <= :to', { to: new Date(`${q.to}T23:59:59.999`) });
    if (q.userId && Number(q.userId) > 0) qb.andWhere('a.userId = :userId', { userId: Number(q.userId) });
    if (q.action) qb.andWhere('a.action IN (:...actions)', { actions: q.action.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12) });
    if (q.entity) qb.andWhere('a.entity = :entity', { entity: q.entity });
    if (q.q?.trim()) {
      qb.andWhere(`(a.summary ILIKE :q OR a."userName" ILIKE :q OR a."userEmail" ILIKE :q OR a.path ILIKE :q)`, { q: `%${escapeLike(q.q.trim())}%` });
    }
    return qb.orderBy('a.createdAt', 'DESC').addOrderBy('a.id', 'DESC');
  }

  async list(actor: any, q: AuditQuery) {
    this.assertAdmin(actor);
    const limit = Math.min(Math.max(parseInt(q.limit ?? '25', 10) || 25, 1), 100);
    const page = Math.max(parseInt(q.page ?? '1', 10) || 1, 1);
    const [items, total] = await this.buildQuery(actor, q).skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async summary(actor: any) {
    this.assertAdmin(actor);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [row] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE action = 'LOGIN')::int AS logins,
              COUNT(*) FILTER (WHERE action IN ('LOGIN_FAILED','DENIED'))::int AS failed,
              COUNT(*) FILTER (WHERE action NOT IN ('LOGIN','LOGIN_FAILED','DENIED'))::int AS changes,
              COUNT(DISTINCT "userId")::int AS users
         FROM audit_logs WHERE "tenantId" = $1 AND "createdAt" >= $2`,
      [actor.tenantId, start],
    );
    return row;
  }

  async filters(actor: any) {
    this.assertAdmin(actor);
    const [actors, entities] = await Promise.all([
      this.dataSource.query(
        `SELECT "userId" AS id, MAX("userName") AS name, MAX("userEmail") AS email, COUNT(*)::int AS events
           FROM audit_logs WHERE "tenantId" = $1 AND "userId" IS NOT NULL
          GROUP BY "userId" ORDER BY events DESC LIMIT 100`, [actor.tenantId]),
      this.dataSource.query(`SELECT DISTINCT entity FROM audit_logs WHERE "tenantId" = $1 AND entity IS NOT NULL`, [actor.tenantId]),
    ]);
    return {
      actors,
      entities: entities.map((e: { entity: string }) => ({ key: e.entity, label: ENTITY_LABELS[e.entity] ?? e.entity }))
        .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)),
      actions: Object.entries(ACTION_LABELS).map(([key, label]) => ({ key, label })),
    };
  }

  /** CSV (con BOM para Excel) de hasta 10 000 eventos con los mismos filtros: sirve como respaldo. */
  async exportCsv(actor: any, q: AuditQuery) {
    this.assertAdmin(actor);
    const rows = await this.buildQuery(actor, q).take(10000).getMany();
    const header = ['Fecha', 'Usuario', 'Correo', 'Roles', 'Acción', 'Módulo', 'Registro', 'Detalle', 'IP', 'Método', 'Ruta', 'Estado HTTP', 'Datos'];
    const lines = rows.map((r) => [
      r.createdAt.toISOString(), r.userName, r.userEmail, r.userRoles, ACTION_LABELS[r.action] ?? r.action,
      r.entity ? ENTITY_LABELS[r.entity] ?? r.entity : '', r.entityId, r.summary, r.ip, r.method, r.path, r.statusCode, r.details,
    ].map(csvCell).join(','));
    return `﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
  }
}
