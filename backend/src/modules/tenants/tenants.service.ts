import { Injectable, ForbiddenException, NotFoundException, ConflictException, Logger, OnModuleInit, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { MailService } from '../../common/mail.service';
import { invalidateTenantStatus } from '../../common/tenancy/tenant-status';
import { Tenant } from './tenant.entity';
import { Subscription } from './subscription.entity';
import { Plan } from './plan.entity';
import { SubscriptionHistory } from './subscription-history.entity';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(Plan) private planRepo: Repository<Plan>,
    @InjectRepository(SubscriptionHistory) private historyRepo: Repository<SubscriptionHistory>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Garantiza el catálogo de planes y el tenant inicial (FashionStore) para que
   * una base de datos nueva arranque en estado consistente. Es idempotente.
   */
  async onModuleInit() {
    try {
      await this.ensureRoles();
    } catch (err) {
      this.logger.error('No se pudieron garantizar los roles base', err as any);
    }
    try {
      await this.ensureSuperAdmin();
    } catch (err) {
      this.logger.error('No se pudo garantizar el SuperAdmin', err as any);
    }
    try {
      // Backfill: si TypeORM agregó la columna code como nullable (tabla preexistente sin esa columna),
      // asignamos el code correcto antes de hacer las búsquedas por code.
      await this.planRepo.query(`
        UPDATE plans SET code = CASE
          WHEN translate(lower(name), 'áéíóú', 'aeiou') LIKE '%basico%' THEN 'BASICO'
          WHEN translate(lower(name), 'áéíóú', 'aeiou') LIKE '%starter%' THEN 'STARTER'
          WHEN translate(lower(name), 'áéíóú', 'aeiou') LIKE '%profesional%' THEN 'PROFESIONAL'
          WHEN translate(lower(name), 'áéíóú', 'aeiou') LIKE '%empresarial%' THEN 'EMPRESARIAL'
          ELSE UPPER(REGEXP_REPLACE(COALESCE(name,'plan'), '[^A-Za-z0-9]', '_', 'g'))
        END
        WHERE code IS NULL`);

      // Anual = 10 meses (2 meses gratis). maxProducts/maxUsers null = ilimitado.
      const plans = [
        { code: 'BASICO', name: 'Plan Básico', priceMonthly: 0, priceYearly: 0, maxBranches: 1, maxProducts: 50, maxUsers: 3, aiGenerativeReports: false, offlineOperations: true },
        { code: 'STARTER', name: 'Plan Starter', priceMonthly: 29, priceYearly: 290, maxBranches: 3, maxProducts: 500, maxUsers: 10, aiGenerativeReports: false, offlineOperations: true },
        { code: 'PROFESIONAL', name: 'Plan Profesional', priceMonthly: 79, priceYearly: 790, maxBranches: 10, maxProducts: null, maxUsers: 50, aiGenerativeReports: true, offlineOperations: true },
        { code: 'EMPRESARIAL', name: 'Plan Empresarial', priceMonthly: 199, priceYearly: 1990, maxBranches: 99, maxProducts: null, maxUsers: null, aiGenerativeReports: true, offlineOperations: true },
      ];
      for (const p of plans) {
        const existing = await this.planRepo.findOne({ where: { code: p.code } });
        if (!existing) await this.planRepo.save(this.planRepo.create(p));
        else await this.planRepo.update({ code: p.code }, p);
      }
      await this.mergeDuplicatePlans(plans);
      const synced = await this.planRepo.find({ order: { priceMonthly: 'ASC' } });
      this.logger.log(`Planes: ${synced.map((x) => `${x.code} $${Number(x.priceMonthly)}`).join(' · ')}`);
      if ((await this.tenantRepo.count()) === 0) {
        const tenant = await this.tenantRepo.save(
          this.tenantRepo.create({ name: 'FashionStore S.R.L.', slug: 'fashionstore-central', active: true }),
        );
        const pro = await this.planRepo.findOneOrFail({ where: { code: 'PROFESIONAL' } });
        await this.subRepo.save(this.subRepo.create({ tenantId: tenant.id, planId: pro.id, status: 'ACTIVE', startDate: new Date() }));
        this.logger.log(`Tenant inicial creado (id=${tenant.id})`);
      }
    } catch (err) {
      this.logger.error('No se pudo inicializar planes/tenant', err as any);
    }
  }

  /**
   * Bases antiguas pudieron generar planes duplicados (mismo nombre, otro code). Se reasignan sus
   * suscripciones al plan canónico del catálogo y se elimina el duplicado.
   */
  private async mergeDuplicatePlans(catalog: { code: string; name: string }[]) {
    const norm = `translate(lower(name), 'áéíóú', 'aeiou')`;
    for (const c of catalog) {
      const canonical = await this.planRepo.findOne({ where: { code: c.code } });
      if (!canonical) continue;
      const dupes: { id: number }[] = await this.planRepo.query(
        `SELECT id FROM plans WHERE code <> $1 AND ${norm} = translate(lower($2), 'áéíóú', 'aeiou')`,
        [c.code, c.name],
      );
      for (const d of dupes) {
        await this.planRepo.query(`UPDATE subscriptions SET plan_id=$1 WHERE plan_id=$2`, [canonical.id, d.id]);
        await this.planRepo.query(`UPDATE subscription_history SET plan_id=$1 WHERE plan_id=$2`, [canonical.id, d.id]);
        await this.planRepo.query(`UPDATE subscription_history SET previous_plan_id=$1 WHERE previous_plan_id=$2`, [canonical.id, d.id]);
        await this.planRepo.query(`DELETE FROM plans WHERE id=$1`, [d.id]);
        this.logger.warn(`Plan duplicado #${d.id} fusionado en ${c.code}`);
      }
    }
  }

  /** Roles base del sistema. Idempotente: evita depender de correr `npm run seed` a mano. */
  private async ensureRoles() {
    const roles: [string, string][] = [
      ['ADMIN', 'Administrador'], ['CLIENTE', 'Cliente'], ['ENCARGADO', 'Encargado de Sucursal'], ['CAJERO', 'Cajero'],
      ['SUPERADMIN', 'Superadministrador de la plataforma'],
    ];
    await this.dataSource.query(
      `SELECT setval(pg_get_serial_sequence('roles','id'), COALESCE((SELECT MAX(id) FROM roles), 0) + 1, false)`,
    );
    for (const [name, description] of roles) {
      await this.dataSource.query(
        `INSERT INTO roles (name, description, active) VALUES ($1,$2,true) ON CONFLICT (name) DO NOTHING`,
        [name, description],
      );
    }
    const total = await this.dataSource.query(`SELECT COUNT(*)::int AS n FROM roles WHERE active`);
    this.logger.log(`Roles base verificados (${total[0].n} activos)`);
  }

  /** Slug reservado de la empresa interna de la plataforma (donde vive el SuperAdmin). */
  static readonly PLATFORM_SLUG = 'plataforma';

  /**
   * Crea el usuario SuperAdmin de la plataforma si se definen SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD
   * (o si ya existe la empresa interna). Idempotente. Nunca se crea con una contraseña por defecto.
   */
  async ensureSuperAdmin() {
    const email = process.env.SUPERADMIN_EMAIL?.trim();
    const password = process.env.SUPERADMIN_PASSWORD;
    if (!email || !password) return;
    let platform = await this.tenantRepo.findOne({ where: { slug: TenantsService.PLATFORM_SLUG } });
    if (!platform) {
      platform = await this.tenantRepo.save(this.tenantRepo.create({ name: 'DRESSED (plataforma)', slug: TenantsService.PLATFORM_SLUG, active: true }));
    }
    const exists = await this.dataSource.query(`SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
    if (exists.length) return;
    const hash = await bcrypt.hash(password, 10);
    const [u] = await this.dataSource.query(
      `INSERT INTO users (name, email, "passwordHash", "tenantId", active, "mustChangePassword", "emailVerified")
       VALUES ($1,$2,$3,$4,true,false,true) RETURNING id`,
      ['Superadministrador', email, hash, platform.id],
    );
    const [role] = await this.dataSource.query(`SELECT id FROM roles WHERE name='SUPERADMIN' LIMIT 1`);
    await this.dataSource.query(`INSERT INTO user_roles ("userId","roleId",active) VALUES ($1,$2,true)`, [u.id, role.id]);
    this.logger.log(`SuperAdmin creado: ${email}`);
  }

  /**
   * Historial de suscripción por SQL directo: lo escribe también el SuperAdmin (otro tenant) y el
   * subscriber anti-suplantación del ORM rechazaría esa inserción cruzada, que aquí es legítima.
   */
  private async writeHistory(tenantId: number, planId: number, previousPlanId: number | null, action: string, notes: string) {
    await this.dataSource.query(
      `INSERT INTO subscription_history (tenant_id, plan_id, previous_plan_id, action, notes) VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, planId, previousPlanId, action, notes],
    );
  }

  /** Fin del período según el ciclo. El plan gratuito no vence. */
  static periodEnd(plan: Plan, cycle: string, from = new Date()): Date | null {
    if (Number(plan.priceMonthly) === 0) return null;
    const end = new Date(from);
    if (cycle === 'YEARLY') end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
    return end;
  }

  static price(plan: Plan, cycle: string) {
    return Number(cycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly);
  }

  private static normalizeCycle(cycle?: string) {
    return cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
  }

  /** Estado efectivo: una suscripción ACTIVE con fecha vencida se muestra como EXPIRED. */
  private static effectiveStatus(sub?: Subscription | null) {
    if (!sub) return null;
    if (sub.status === 'ACTIVE' && sub.endDate && new Date(sub.endDate) < new Date()) return 'EXPIRED';
    return sub.status;
  }

  /** Uso actual de cada recurso limitado por el plan. */
  private async usage(tenantId: number) {
    const [r] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM branches WHERE "tenantId"=$1 AND active=true) AS branches,
         (SELECT COUNT(*)::int FROM products WHERE "tenantId"=$1 AND active=true) AS products,
         (SELECT COUNT(DISTINCT u.id)::int FROM users u JOIN user_roles ur ON ur."userId"=u.id AND ur.active=true
            JOIN roles ro ON ro.id=ur."roleId"
           WHERE u."tenantId"=$1 AND u.active=true AND ro.name IN ('ADMIN','ENCARGADO','CAJERO')) AS users`,
      [tenantId],
    );
    return r as { branches: number; products: number; users: number };
  }

  async getMyTenant(tenantId: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: { subscription: { plan: true } },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    const sub = tenant.subscription;
    const status = TenantsService.effectiveStatus(sub);
    const daysLeft = sub?.endDate ? Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86_400_000) : null;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: sub?.plan ?? null,
      subscriptionStatus: status,
      subscription: sub ? { status, billingCycle: sub.billingCycle, startDate: sub.startDate, endDate: sub.endDate, daysLeft } : null,
      usage: await this.usage(tenantId),
      storeConfig: TenantsService.normalizeStoreConfig(tenant.storeConfig),
    };
  }

  static readonly STORE_DEFAULTS = {
    published: true, tagline: '', heroTitle: '', heroText: '', accentColor: '#C9904A', logoUrl: '',
    whatsapp: '', instagram: '', showFeatured: true, showBranches: true, showTryOn: true,
  };

  static normalizeStoreConfig(raw: any) {
    const d = TenantsService.STORE_DEFAULTS;
    const c = raw && typeof raw === 'object' ? raw : {};
    const str = (v: any, max: number, def: string) => (typeof v === 'string' ? v.trim().slice(0, max) : def);
    const bool = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def);
    const color = typeof c.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.accentColor) ? c.accentColor : d.accentColor;
    const logo = str(c.logoUrl, 500, '');
    return {
      published: bool(c.published, d.published),
      tagline: str(c.tagline, 120, ''),
      heroTitle: str(c.heroTitle, 80, ''),
      heroText: str(c.heroText, 300, ''),
      accentColor: color,
      logoUrl: /^https?:\/\//i.test(logo) ? logo : '',
      whatsapp: str(c.whatsapp, 25, '').replace(/[^0-9+]/g, ''),
      instagram: str(c.instagram, 40, '').replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, ''),
      showFeatured: bool(c.showFeatured, d.showFeatured),
      showBranches: bool(c.showBranches, d.showBranches),
      showTryOn: bool(c.showTryOn, d.showTryOn),
    };
  }

  async updateStoreConfig(tenantId: number, body: any) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    tenant.storeConfig = TenantsService.normalizeStoreConfig({ ...(tenant.storeConfig ?? {}), ...(body ?? {}) });
    await this.tenantRepo.save(tenant);
    return this.getMyTenant(tenantId);
  }

  /** Rechaza el cambio si la empresa usa más recursos de los que permite el plan destino. */
  async assertWithinPlan(tenantId: number, plan: Plan) {
    const use = await this.usage(tenantId);
    const over: string[] = [];
    if (use.branches > plan.maxBranches) over.push(`${use.branches} sucursales (máx. ${plan.maxBranches})`);
    if (plan.maxProducts != null && use.products > plan.maxProducts) over.push(`${use.products} productos (máx. ${plan.maxProducts})`);
    if (plan.maxUsers != null && use.users > plan.maxUsers) over.push(`${use.users} usuarios internos (máx. ${plan.maxUsers})`);
    if (over.length) {
      throw new ConflictException(`No se puede cambiar al plan ${plan.name}: la empresa usa ${over.join(', ')}. Reduce el uso primero.`);
    }
  }

  /**
   * Contrata, cambia o renueva el plan. Reinicia el período según el ciclo (mensual/anual).
   * Se rechaza si la empresa usa más recursos de los que permite el plan destino.
   */
  async changePlan(tenantId: number, planCode: string, billingCycle?: string, actor = 'ADMIN') {
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} no existe`);
    const sub = await this.subRepo.findOne({ where: { tenantId }, relations: { plan: true } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    const cycle = Number(plan.priceMonthly) === 0 ? 'MONTHLY' : TenantsService.normalizeCycle(billingCycle);

    await this.assertWithinPlan(tenantId, plan);

    const previousPlanId = sub.planId;
    const prevPrice = Number(sub.plan?.priceMonthly ?? 0);
    const action = previousPlanId === plan.id ? 'RENEW' : Number(plan.priceMonthly) >= prevPrice ? 'UPGRADE' : 'DOWNGRADE';
    const now = new Date();
    sub.planId = plan.id;
    sub.plan = plan; // la relación cargada tiene prioridad sobre planId al guardar
    sub.billingCycle = cycle;
    sub.status = 'ACTIVE';
    sub.startDate = now;
    sub.endDate = TenantsService.periodEnd(plan, cycle, now) as any;
    await this.subRepo.save(sub);
    const amount = TenantsService.price(plan, cycle);
    await this.writeHistory(tenantId, plan.id, previousPlanId, action,
      `${actor}: ${plan.code} ${cycle === 'YEARLY' ? 'anual' : 'mensual'} · USD ${amount.toFixed(2)}`);
    return this.getMyTenant(tenantId);
  }

  // ───────────── Panel SuperAdmin (plataforma) ─────────────

  /** Resumen del negocio SaaS: empresas, estados, ingresos recurrentes e ingresos por plan. */
  async adminOverview() {
    const rows = await this.dataSource.query(
      `SELECT t.id, t.active, s.status, s.billing_cycle AS cycle, s.end_date AS "endDate", p.code, p."priceMonthly", p."priceYearly", t."createdAt"
         FROM tenants t
         LEFT JOIN subscriptions s ON s.tenant_id = t.id
         LEFT JOIN plans p ON p.id = s.plan_id
        WHERE t.slug <> $1`, [TenantsService.PLATFORM_SLUG]);
    const now = Date.now();
    const byPlan: Record<string, number> = {};
    let active = 0, suspended = 0, expired = 0, mrr = 0, newLast30 = 0;
    for (const r of rows) {
      const isExpired = r.status === 'ACTIVE' && r.endDate && new Date(r.endDate).getTime() < now;
      if (!r.active || r.status === 'SUSPENDED') suspended++;
      else if (isExpired) expired++;
      else {
        active++;
        mrr += r.cycle === 'YEARLY' ? Number(r.priceYearly) / 12 : Number(r.priceMonthly);
      }
      if (r.code) byPlan[r.code] = (byPlan[r.code] ?? 0) + 1;
      if (now - new Date(r.createdAt).getTime() < 30 * 86_400_000) newLast30++;
    }
    return {
      tenants: rows.length, active, suspended, expired, newLast30,
      mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
      byPlan: Object.entries(byPlan).map(([code, count]) => ({ code, count })),
    };
  }

  /** Listado de empresas con plan, vigencia y consumo. */
  async adminTenants() {
    const rows = await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, t.active, t."createdAt",
              p.code AS "planCode", p.name AS "planName", p."maxBranches", p."maxProducts", p."maxUsers",
              s.status, s.billing_cycle AS "billingCycle", s.start_date AS "startDate", s.end_date AS "endDate",
              (SELECT COUNT(*)::int FROM branches b WHERE b."tenantId"=t.id AND b.active=true) AS branches,
              (SELECT COUNT(*)::int FROM products pr WHERE pr."tenantId"=t.id AND pr.active=true) AS products,
              (SELECT COUNT(DISTINCT u.id)::int FROM users u JOIN user_roles ur ON ur."userId"=u.id AND ur.active=true
                 JOIN roles ro ON ro.id=ur."roleId" WHERE u."tenantId"=t.id AND u.active=true AND ro.name IN ('ADMIN','ENCARGADO','CAJERO')) AS users,
              (SELECT u.email FROM users u JOIN user_roles ur ON ur."userId"=u.id JOIN roles ro ON ro.id=ur."roleId"
                WHERE u."tenantId"=t.id AND ro.name='ADMIN' ORDER BY u.id LIMIT 1) AS "adminEmail"
         FROM tenants t
         LEFT JOIN subscriptions s ON s.tenant_id = t.id
         LEFT JOIN plans p ON p.id = s.plan_id
        WHERE t.slug <> $1
        ORDER BY t.id DESC`, [TenantsService.PLATFORM_SLUG]);
    return rows.map((r: any) => {
      const expired = r.status === 'ACTIVE' && r.endDate && new Date(r.endDate) < new Date();
      return { ...r, effectiveStatus: !r.active ? 'SUSPENDED' : expired ? 'EXPIRED' : r.status };
    });
  }

  /** Suspende o reactiva una empresa (bloquea inicio de sesión y tienda pública). */
  async adminSetActive(id: number, active: boolean) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant || tenant.slug === TenantsService.PLATFORM_SLUG) throw new NotFoundException('Empresa no encontrada');
    tenant.active = !!active;
    await this.tenantRepo.save(tenant);
    invalidateTenantStatus(id);
    await this.subRepo.update({ tenantId: id }, { status: active ? 'ACTIVE' : 'SUSPENDED' });
    const sub = await this.subRepo.findOne({ where: { tenantId: id } });
    if (sub) {
      await this.writeHistory(id, sub.planId, sub.planId, active ? 'REACTIVATE' : 'SUSPEND', 'SUPERADMIN');
    }
    return { id, active: tenant.active };
  }

  /** El SuperAdmin cambia el plan/ciclo de una empresa (o la renueva). */
  async adminChangePlan(id: number, planCode: string, billingCycle?: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant || tenant.slug === TenantsService.PLATFORM_SLUG) throw new NotFoundException('Empresa no encontrada');
    return this.changePlan(id, planCode, billingCycle, 'SUPERADMIN');
  }

  /** Extiende la vigencia (días de cortesía). */
  async adminExtend(id: number, days: number) {
    const d = Math.floor(Number(days));
    if (!Number.isFinite(d) || d < 1 || d > 365) throw new BadRequestException('Indica entre 1 y 365 días');
    const sub = await this.subRepo.findOne({ where: { tenantId: id } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    const base = sub.endDate && new Date(sub.endDate) > new Date() ? new Date(sub.endDate) : new Date();
    base.setDate(base.getDate() + d);
    sub.endDate = base;
    sub.status = 'ACTIVE';
    await this.subRepo.save(sub);
    await this.writeHistory(id, sub.planId, sub.planId, 'EXTEND', `SUPERADMIN: +${d} días`);
    return this.getMyTenant(id);
  }

  findAllPlans() {
    return this.planRepo.find({ order: { priceMonthly: 'ASC' } });
  }

  async findBySlugPublic(slug: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug } });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    if (!tenant.active) {
      throw new ForbiddenException({ message: 'Esta tienda no está disponible por el momento.', code: 'TENANT_SUSPENDED' });
    }
    const branches = await this.dataSource.query(
      `SELECT b.name, b.address, b.phone, c.name AS city
         FROM branches b LEFT JOIN cities c ON c.id = b."cityId"
        WHERE b."tenantId" = $1 AND b.active = true ORDER BY b.id`,
      [tenant.id],
    );
    return { name: tenant.name, slug: tenant.slug, branches, config: TenantsService.normalizeStoreConfig(tenant.storeConfig) };
  }

  async findAll() {
    return this.tenantRepo.find({
      relations: { subscription: { plan: true } },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      relations: { subscription: { plan: true }, branches: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    return tenant;
  }

  private newCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Envía el código; si el SMTP no está configurado, en desarrollo lo deja en consola y lo devuelve. */
  private async deliverCode(email: string, name: string, code: string, tenantName: string) {
    try {
      await this.mailService.sendTenantVerificationCode(email, name, code, tenantName);
      return { emailSent: true as const, devCode: undefined };
    } catch (err) {
      const dev = process.env.NODE_ENV !== 'production';
      this.logger.warn(`No se pudo enviar el correo a ${email}: ${(err as Error).message}`);
      if (dev) this.logger.warn(`[DEV] Código de verificación para ${email}: ${code}`);
      return { emailSent: false as const, devCode: dev ? code : undefined };
    }
  }

  async createTenant(data: {
    name: string; slug: string; taxId?: string; planCode?: string; billingCycle?: string;
    adminName?: string; adminEmail?: string; adminPassword?: string;
  }) {
    const adminEmail = data.adminEmail?.trim();
    if (adminEmail) {
      if (!data.adminName?.trim()) throw new BadRequestException('El nombre del administrador es obligatorio');
      if (!data.adminPassword || data.adminPassword.length < 6) {
        throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
      }
    }

    const existing = await this.tenantRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException(`El slug "${data.slug}" ya está registrado`);

    if (adminEmail) {
      const emailInUse = await this.dataSource.query(`SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [adminEmail]);
      if (emailInUse.length > 0) throw new ConflictException(`El correo "${adminEmail}" ya está en uso`);
    }

    const planCode = data.planCode || 'BASICO';
    const requested = await this.planRepo.findOne({ where: { code: planCode } });
    if (!requested) throw new NotFoundException(`Plan ${planCode} no existe`);
    // Con cobro real activo (Stripe) un plan de pago NO se concede gratis al registrarse: la empresa nace en
    // Básico y el administrador paga desde "Mi suscripción". Se informa en `pendingPlan`.
    const stripeOn = !!process.env.STRIPE_SECRET_KEY && /^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY) && process.env.STRIPE_SECRET_KEY !== 'sk_test_mock';
    const deferPayment = stripeOn && Number(requested.priceMonthly) > 0;
    const plan = deferPayment ? (await this.planRepo.findOneOrFail({ where: { code: 'BASICO' } })) : requested;
    const pendingPlan = deferPayment ? { code: requested.code, name: requested.name, billingCycle: TenantsService.normalizeCycle(data.billingCycle) } : null;

    await this.ensureRoles();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const tenant = qr.manager.create(Tenant, { name: data.name, slug: data.slug, taxId: data.taxId, active: true });
      const savedTenant = await qr.manager.save(tenant);

      const cycle = Number(plan.priceMonthly) === 0 ? 'MONTHLY' : TenantsService.normalizeCycle(data.billingCycle);
      const startedAt = new Date();
      await qr.manager.save(this.subRepo.create({
        tenantId: savedTenant.id, planId: plan.id, status: 'ACTIVE', billingCycle: cycle,
        startDate: startedAt, endDate: TenantsService.periodEnd(plan, cycle, startedAt) as any,
      }));
      await qr.manager.save(this.historyRepo.create({
        tenantId: savedTenant.id, planId: plan.id, action: 'SUBSCRIBE',
        notes: `Alta: ${plan.code} ${cycle === 'YEARLY' ? 'anual' : 'mensual'} · USD ${TenantsService.price(plan, cycle).toFixed(2)}`,
      }));

      let adminUser: { id: number; email: string; name: string } | undefined;
      let code: string | undefined;

      if (adminEmail && data.adminPassword && data.adminName) {
        const passwordHash = await bcrypt.hash(data.adminPassword, 10);
        code = this.newCode();
        const codeHash = await bcrypt.hash(code, 10);
        const [userRow] = await qr.manager.query(
          `INSERT INTO users (name, email, "passwordHash", "tenantId", active, "mustChangePassword", "emailVerified",
                              "verificationCodeHash", "verificationCodeExpiresAt", "verificationAttempts")
           VALUES ($1,$2,$3,$4,true,false,false,$5,$6,0) RETURNING id`,
          [data.adminName.trim(), adminEmail, passwordHash, savedTenant.id, codeHash, new Date(Date.now() + 15 * 60_000)],
        );

        const [roleRow] = await qr.manager.query(`SELECT id FROM roles WHERE name='ADMIN' LIMIT 1`);
        if (!roleRow) {
          throw new InternalServerErrorException('El rol ADMIN no existe en la base de datos. Asegúrese de correr los seeds.');
        }
        await qr.manager.query(`INSERT INTO user_roles ("userId","roleId",active) VALUES ($1,$2,true)`, [userRow.id, roleRow.id]);
        adminUser = { id: userRow.id, email: adminEmail, name: data.adminName.trim() };
      }

      await qr.commitTransaction();

      const base = {
        tenant: { id: savedTenant.id, name: savedTenant.name, slug: savedTenant.slug },
        plan: { code: plan.code, name: plan.name, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly },
        pendingPlan,
      };
      if (!adminUser || !code) return { ...base, requiresVerification: false };

      const delivery = await this.deliverCode(adminUser.email, adminUser.name, code, savedTenant.name);
      return { ...base, adminUser: { email: adminUser.email, name: adminUser.name }, requiresVerification: true, ...delivery };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async verifyEmail(emailRaw: string, code: string) {
    const email = (emailRaw ?? '').trim();
    if (!email || !/^\d{6}$/.test(code ?? '')) throw new BadRequestException('Ingresa el código de 6 dígitos');

    const [u] = await this.dataSource.query(
      `SELECT id, name, email, "tenantId", "verificationCodeHash", "verificationCodeExpiresAt", "verificationAttempts"
         FROM users
        WHERE LOWER(email)=LOWER($1) AND "emailVerified"=false AND "verificationCodeHash" IS NOT NULL
        LIMIT 1`,
      [email],
    );
    if (!u) throw new BadRequestException('No hay una verificación pendiente para este correo.');
    if (new Date() > new Date(u.verificationCodeExpiresAt)) {
      throw new BadRequestException('El código expiró. Solicita uno nuevo.');
    }
    if (u.verificationAttempts >= 5) {
      throw new BadRequestException('Demasiados intentos fallidos. Solicita un nuevo código.');
    }
    if (!(await bcrypt.compare(code, u.verificationCodeHash))) {
      await this.dataSource.query(`UPDATE users SET "verificationAttempts" = "verificationAttempts" + 1 WHERE id=$1`, [u.id]);
      throw new BadRequestException('Código incorrecto.');
    }

    await this.dataSource.query(
      `UPDATE users SET "emailVerified"=true, "verificationCodeHash"=NULL, "verificationCodeExpiresAt"=NULL, "verificationAttempts"=0 WHERE id=$1`,
      [u.id],
    );

    const [info] = await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, p.name AS "planName"
         FROM tenants t
         LEFT JOIN subscriptions s ON s.tenant_id = t.id
         LEFT JOIN plans p ON p.id = s.plan_id
        WHERE t.id=$1`,
      [u.tenantId],
    );

    this.mailService
      .sendTenantWelcome(u.email, u.name, info.name, info.slug, info.planName ?? '')
      .catch((err) => this.logger.warn(`No se pudo enviar el correo de bienvenida: ${err.message}`));

    const accessToken = this.jwtService.sign({
      sub: u.id, email: u.email, tenantId: u.tenantId, roles: ['ADMIN'], name: u.name,
    });
    return {
      accessToken,
      user: { id: u.id, email: u.email, name: u.name, roles: ['ADMIN'] },
      tenant: { id: info.id, name: info.name, slug: info.slug },
    };
  }

  async resendVerificationCode(emailRaw: string) {
    const generic = { message: 'Si existe una verificación pendiente, enviamos un nuevo código.' };
    const email = (emailRaw ?? '').trim();
    if (!email) return generic;

    const [u] = await this.dataSource.query(
      `SELECT u.id, u.name, u.email, u."verificationCodeExpiresAt", t.name AS "tenantName"
         FROM users u JOIN tenants t ON t.id = u."tenantId"
        WHERE LOWER(u.email)=LOWER($1) AND u."emailVerified"=false AND u."verificationCodeHash" IS NOT NULL
        LIMIT 1`,
      [email],
    );
    if (!u) return generic;

    const issuedAt = new Date(u.verificationCodeExpiresAt).getTime() - 15 * 60_000;
    if (Date.now() - issuedAt < 60_000) {
      throw new BadRequestException('Espera un minuto antes de pedir otro código.');
    }

    const code = this.newCode();
    await this.dataSource.query(
      `UPDATE users SET "verificationCodeHash"=$2, "verificationCodeExpiresAt"=$3, "verificationAttempts"=0 WHERE id=$1`,
      [u.id, await bcrypt.hash(code, 10), new Date(Date.now() + 15 * 60_000)],
    );
    const delivery = await this.deliverCode(u.email, u.name, code, u.tenantName);
    return { ...generic, emailSent: delivery.emailSent, devCode: delivery.devCode };
  }
}
