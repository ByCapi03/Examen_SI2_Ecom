import { Injectable, NotFoundException, ConflictException, Logger, OnModuleInit, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { MailService } from '../../common/mail.service';
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

      const plans = [
        { code: 'BASICO', name: 'Plan Básico', priceMonthly: 0, maxBranches: 1, aiGenerativeReports: false, offlineOperations: true },
        { code: 'STARTER', name: 'Plan Starter', priceMonthly: 29, maxBranches: 3, aiGenerativeReports: false, offlineOperations: true },
        { code: 'PROFESIONAL', name: 'Plan Profesional', priceMonthly: 79, maxBranches: 10, aiGenerativeReports: true, offlineOperations: true },
        { code: 'EMPRESARIAL', name: 'Plan Empresarial', priceMonthly: 199, maxBranches: 99, aiGenerativeReports: true, offlineOperations: true },
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

  async getMyTenant(tenantId: number) {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      relations: { subscription: { plan: true } },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.subscription?.plan ?? null,
      subscriptionStatus: tenant.subscription?.status ?? null,
    };
  }

  async changePlan(tenantId: number, planCode: string) {
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} no existe`);
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    const previousPlanId = sub.planId;
    sub.planId = plan.id;
    await this.subRepo.save(sub);
    await this.historyRepo.save(this.historyRepo.create({
      tenantId, planId: plan.id, previousPlanId, action: 'CHANGE_PLAN', notes: `Cambio a ${plan.code}`,
    }));
    return this.getMyTenant(tenantId);
  }

  findAllPlans() {
    return this.planRepo.find({ order: { priceMonthly: 'ASC' } });
  }

  async findBySlugPublic(slug: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug, active: true } });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    const branches = await this.dataSource.query(
      `SELECT b.name, b.address, b.phone, c.name AS city
         FROM branches b LEFT JOIN cities c ON c.id = b."cityId"
        WHERE b."tenantId" = $1 AND b.active = true ORDER BY b.id`,
      [tenant.id],
    );
    return { name: tenant.name, slug: tenant.slug, branches };
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
    name: string; slug: string; taxId?: string; planCode?: string;
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
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} no existe`);

    await this.ensureRoles();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const tenant = qr.manager.create(Tenant, { name: data.name, slug: data.slug, taxId: data.taxId, active: true });
      const savedTenant = await qr.manager.save(tenant);

      await qr.manager.save(this.subRepo.create({ tenantId: savedTenant.id, planId: plan.id, status: 'ACTIVE', startDate: new Date() }));
      await qr.manager.save(this.historyRepo.create({ tenantId: savedTenant.id, planId: plan.id, action: 'SUBSCRIBE', notes: 'Alta de tenant' }));

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
        plan: { code: plan.code, name: plan.name, priceMonthly: plan.priceMonthly },
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
