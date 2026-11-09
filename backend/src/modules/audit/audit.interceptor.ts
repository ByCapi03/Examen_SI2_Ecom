/**
 * AUDIT INTERCEPTOR (global)
 * Tras el guard de autenticación, registra los cambios (POST/PUT/PATCH/DELETE) del personal y los accesos.
 * Los guards rechazan antes de llegar aquí, por eso los 401/403 de guards no se registran.
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditEntry, AuditService, ENTITY_LABELS } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const STAFF = ['ADMIN', 'ENCARGADO', 'CAJERO'];
const SKIP = [/^\/notifications/, /^\/sync/, /^\/audit-logs/, /^\/auth\/(?!login)/, /^\/saas\/tenants\/resend-code/];

const RULES: { re: RegExp; action: string; verb: string }[] = [
  { re: /^\/cash-sessions\/open$/, action: 'CASH_OPEN', verb: 'Abrió caja' },
  { re: /^\/cash-sessions(\/\d+)?\/close$/, action: 'CASH_CLOSE', verb: 'Cerró caja' },
  { re: /^\/inventory\/movement$/, action: 'STOCK_MOVEMENT', verb: 'Registró un movimiento de stock' },
  { re: /\/resend-temporary-password$/, action: 'PASSWORD_RESET', verb: 'Reenvió la contraseña temporal de' },
];

const clip = (v: unknown, n = 60) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest();
    if (!MUTATING.has(req.method)) return next.handle();
    const path: string = String(req.originalUrl ?? req.url ?? '').split('?')[0];
    if (SKIP.some((re) => re.test(path))) return next.handle();

    return next.handle().pipe(
      tap({
        next: (data) => { void this.onSuccess(req, http.getResponse().statusCode, path, data); },
        error: (err) => { void this.onError(req, path, err); },
      }),
    );
  }

  private base(req: any, path: string): Pick<AuditEntry, 'method' | 'path' | 'ip' | 'userAgent'> {
    const forwarded = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
    return { method: req.method, path, ip: forwarded || req.ip || null, userAgent: clip(req.headers?.['user-agent'], 200) ?? null };
  }

  private async onSuccess(req: any, statusCode: number, path: string, data: any) {
    try {
      const base = this.base(req, path);

      // --- Accesos y altas públicas (no hay req.user) ---
      if (path === '/auth/login' && data?.user?.id) {
        const u = await this.audit.lookupUser({ id: data.user.id });
        if (!u || !u.roles.some((r) => STAFF.includes(r))) return; // solo se audita al personal
        return void (await this.audit.record({
          ...base, tenantId: u.tenantId, userId: u.id, userName: u.name, userEmail: u.email, userRoles: u.roles, branchId: u.branchId,
          action: 'LOGIN', entity: 'auth', summary: `Inició sesión (${u.roles.filter((r) => STAFF.includes(r)).join(', ')})`, statusCode,
        }));
      }
      if (path === '/saas/tenants/register' && data?.tenant?.id) {
        return void (await this.audit.record({
          ...base, tenantId: data.tenant.id, userName: data.adminUser?.name, userEmail: data.adminUser?.email, userRoles: ['ADMIN'],
          action: 'TENANT_REGISTER', entity: 'tenants', entityId: data.tenant.id,
          summary: `Registró la empresa "${data.tenant.name}" (${data.plan?.name ?? 'plan'})`, statusCode,
        }));
      }
      if (path === '/saas/tenants/verify-email' && data?.user?.id) {
        return void (await this.audit.record({
          ...base, tenantId: data.tenant.id, userId: data.user.id, userName: data.user.name, userEmail: data.user.email, userRoles: ['ADMIN'],
          action: 'EMAIL_VERIFIED', entity: 'tenants', entityId: data.tenant.id, summary: 'Verificó el correo y activó la cuenta', statusCode,
        }));
      }

      // --- Cambios del personal autenticado ---
      const user = req.user;
      if (!user?.tenantId || !user.roles?.some((r: string) => STAFF.includes(r))) return;

      const segments = path.split('/').filter(Boolean);
      const entity = segments[0] === 'saas' ? segments[1] : segments[0];
      const entityId = segments.find((s) => /^\d+$/.test(s)) ?? data?.id ?? data?.session?.id;
      const rule = RULES.find((r) => r.re.test(path));
      const [action, verb] = rule
        ? [rule.action, rule.verb]
        : req.method === 'POST' ? ['CREATE', 'Creó'] : req.method === 'DELETE' ? ['DELETE', 'Eliminó'] : ['UPDATE', 'Modificó'];
      const label = ENTITY_LABELS[entity] ?? entity ?? 'registro';
      const name = clip(req.body?.name) ?? clip(data?.name) ?? clip(req.body?.email);
      const b = req.body ?? {};
      const summary = rule?.action === 'CASH_OPEN'
        ? `${verb}${b.registerId ? ` #${b.registerId}` : ''}${b.cashierId ? ` para el cajero #${b.cashierId}` : ''}`
        : rule?.action === 'CASH_CLOSE'
          ? `${verb}${entityId ? ` (turno #${entityId})` : ''}`
          : `${verb} ${label}${name ? ` "${name}"` : ''}${entityId ? ` #${entityId}` : ''}`;

      await this.audit.record({
        ...base, tenantId: user.tenantId, userId: user.sub, userEmail: user.email, userRoles: user.roles, branchId: user.branchId,
        action, entity, entityId, summary, body: req.body, statusCode,
      });
    } catch { /* la auditoría nunca debe romper la respuesta */ }
  }

  private async onError(req: any, path: string, err: any) {
    try {
      const status: number = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
      const base = this.base(req, path);

      if (path === '/auth/login' && status === 401 && typeof req.body?.email === 'string') {
        const u = await this.audit.lookupUser({ email: req.body.email });
        if (!u || !u.roles.some((r) => STAFF.includes(r))) return; // sin empresa identificable no se registra
        return void (await this.audit.record({
          ...base, tenantId: u.tenantId, userId: u.id, userName: u.name, userEmail: u.email, userRoles: u.roles, branchId: u.branchId,
          action: 'LOGIN_FAILED', entity: 'auth', summary: 'Intento de acceso fallido (credenciales incorrectas)', statusCode: status,
        }));
      }

      const user = req.user;
      if (status === 403 && user?.tenantId && user.roles?.some((r: string) => STAFF.includes(r))) {
        const segments = path.split('/').filter(Boolean);
        const entity = segments[0] === 'saas' ? segments[1] : segments[0];
        await this.audit.record({
          ...base, tenantId: user.tenantId, userId: user.sub, userEmail: user.email, userRoles: user.roles, branchId: user.branchId,
          action: 'DENIED', entity, summary: `Acción denegada en ${ENTITY_LABELS[entity] ?? entity}: ${clip(err?.message, 160) ?? 'sin permiso'}`, statusCode: status,
        });
      }
    } catch { /* ignorar */ }
  }
}
