/**
 * PLAN FEATURES
 * Consulta el plan activo del tenant y expone un guard declarativo para
 * restringir funcionalidades según la suscripción (p. ej. reportes generativos
 * con IA y analítica ML solo para el Plan PROFESIONAL).
 */
import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

export type PlanFeature = 'aiGenerativeReports' | 'offlineOperations';

export interface ActivePlan {
  code: string;
  name: string;
  maxBranches: number;
  aiGenerativeReports: boolean;
  offlineOperations: boolean;
}

export const PLAN_FEATURE_KEY = 'requiredPlanFeature';
export const RequiresPlanFeature = (feature: PlanFeature) => SetMetadata(PLAN_FEATURE_KEY, feature);

export async function getActivePlan(dataSource: DataSource, tenantId: number): Promise<ActivePlan | null> {
  const rows = await dataSource.query(
    `SELECT p.code, p.name, p."maxBranches", p."aiGenerativeReports", p."offlineOperations"
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = $1 AND s.status = 'ACTIVE'
      ORDER BY s.id DESC LIMIT 1`,
    [tenantId],
  );
  return rows[0] ?? null;
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
    if (!plan || !plan[feature]) {
      throw new ForbiddenException(
        `Su plan actual (${plan?.name ?? 'sin suscripción'}) no incluye esta funcionalidad. Actualice al Plan Profesional.`,
      );
    }
    return true;
  }
}
