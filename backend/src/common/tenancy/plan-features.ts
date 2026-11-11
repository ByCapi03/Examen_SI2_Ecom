/**
 * PLAN FEATURES
 * Consulta el plan activo del tenant y expone un guard declarativo para
 * restringir funcionalidades según la suscripción (p. ej. reportes generativos
 * con IA y analítica ML solo para el Plan PROFESIONAL).
 */
import {
  CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

export type PlanFeature = 'aiGenerativeReports' | 'offlineOperations' | 'basicReports';

export interface ActivePlan {
  code: string;
  name: string;
  maxBranches: number;
  maxProducts: number | null;
  maxUsers: number | null;
  billingCycle: string;
  endDate: Date | null;
  aiGenerativeReports: boolean;
  offlineOperations: boolean;
}

export const PLAN_FEATURE_KEY = 'requiredPlanFeature';
export const RequiresPlanFeature = (feature: PlanFeature) => SetMetadata(PLAN_FEATURE_KEY, feature);

export async function getActivePlan(dataSource: DataSource, tenantId: number): Promise<ActivePlan | null> {
  const rows = await dataSource.query(
    `SELECT p.code, p.name, p."maxBranches", p."maxProducts", p."maxUsers", p."aiGenerativeReports", p."offlineOperations",
            s.billing_cycle AS "billingCycle", s.end_date AS "endDate"
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = $1 AND s.status = 'ACTIVE'
        AND (s.end_date IS NULL OR s.end_date > NOW())
      ORDER BY s.id DESC LIMIT 1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

/** Tipos de límite que dependen del plan. */
export type PlanLimit = 'branches' | 'products' | 'users';

/**
 * Valida que la empresa pueda crear un recurso más según su plan.
 *  - Sin plan vigente (vencido o suspendido) → 402 pidiendo renovar.
 *  - Al llegar al máximo del plan → 403 indicando el límite.
 */
export async function assertPlanLimit(ds: DataSource, tenantId: number, kind: PlanLimit) {
  const plan = await getActivePlan(ds, tenantId);
  if (!plan) {
    throw new HttpException('Tu suscripción está vencida o suspendida. Renueva tu plan para continuar.', HttpStatus.PAYMENT_REQUIRED);
  }
  const rules: Record<PlanLimit, { max: number | null; label: string; sql: string }> = {
    branches: { max: plan.maxBranches, label: 'sucursales activas', sql: `SELECT COUNT(*)::int n FROM branches WHERE "tenantId"=$1 AND active=true` },
    products: { max: plan.maxProducts, label: 'productos activos', sql: `SELECT COUNT(*)::int n FROM products WHERE "tenantId"=$1 AND active=true` },
    users: {
      max: plan.maxUsers, label: 'usuarios internos activos',
      sql: `SELECT COUNT(DISTINCT u.id)::int n FROM users u JOIN user_roles ur ON ur."userId"=u.id AND ur.active=true
              JOIN roles r ON r.id=ur."roleId" WHERE u."tenantId"=$1 AND u.active=true AND r.name IN ('ADMIN','ENCARGADO','CAJERO')`,
    },
  };
  const rule = rules[kind];
  if (rule.max == null) return plan;
  const [{ n }] = await ds.query(rule.sql, [tenantId]);
  if (n >= rule.max) {
    throw new ForbiddenException(`El plan ${plan.name} permite como máximo ${rule.max} ${rule.label}. Mejora tu plan para agregar más.`);
  }
  return plan;
}

// El plan gratuito (BASICO) no incluye reportes; cualquier plan de pago sí.
export function hasPlanFeature(plan: ActivePlan, feature: PlanFeature): boolean {
  if (feature === 'basicReports') return plan.code !== 'BASICO';
  return !!plan[feature];
}

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user?.tenantId) throw new ForbiddenException('Tenant no identificado');
    const plan = await getActivePlan(this.dataSource, user.tenantId);
    // Sincronización offline: con el plan vencido (no suspendido) se sigue aceptando lo ya registrado
    // sin conexión, para no dejar dinero ni ventas atrapados en los dispositivos.
    if (!plan && feature === 'offlineOperations') {
      const [sub] = await this.dataSource.query(
        `SELECT status FROM subscriptions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`, [user.tenantId]);
      if (sub && sub.status !== 'SUSPENDED') return true;
    }
    if (!plan || !hasPlanFeature(plan, feature)) {
      const target = feature === 'basicReports' ? 'Starter' : 'Profesional';
      throw new ForbiddenException(
        `Su plan actual (${plan?.name ?? 'sin suscripción'}) no incluye esta funcionalidad. Actualice al Plan ${target}.`,
      );
    }
    return true;
  }
}
