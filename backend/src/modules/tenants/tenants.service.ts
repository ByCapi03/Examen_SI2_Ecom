import { Injectable, NotFoundException, ConflictException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  /**
   * Garantiza el catálogo de planes y el tenant inicial (FashionStore) para que
   * una base de datos nueva arranque en estado consistente. Es idempotente.
   */
  async onModuleInit() {
    try {
      // Backfill: si TypeORM agregó la columna code como nullable (tabla preexistente sin esa columna),
      // asignamos el code correcto antes de hacer las búsquedas por code.
      await this.planRepo.query(`UPDATE plans SET code = 'BASICO' WHERE code IS NULL AND name ILIKE '%basico%'`);
      await this.planRepo.query(`UPDATE plans SET code = 'PROFESIONAL' WHERE code IS NULL AND name ILIKE '%profesional%'`);
      await this.planRepo.query(`UPDATE plans SET code = UPPER(REGEXP_REPLACE(COALESCE(name,'plan'), '[^A-Za-z0-9]', '_', 'g')) WHERE code IS NULL`);

      const plans = [
        { code: 'BASICO', name: 'Plan Básico', priceMonthly: 0, maxBranches: 1, aiGenerativeReports: false, offlineOperations: true },
        { code: 'STARTER', name: 'Plan Starter', priceMonthly: 29, maxBranches: 3, aiGenerativeReports: false, offlineOperations: true },
        { code: 'PROFESIONAL', name: 'Plan Profesional', priceMonthly: 79, maxBranches: 10, aiGenerativeReports: true, offlineOperations: true },
        { code: 'EMPRESARIAL', name: 'Plan Empresarial', priceMonthly: 199, maxBranches: 99, aiGenerativeReports: true, offlineOperations: true },
      ];
      for (const p of plans) {
        const existing = await this.planRepo.findOne({ where: { code: p.code } });
        if (!existing) await this.planRepo.save(this.planRepo.create(p));
      }
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

  async createTenant(data: { name: string; slug: string; taxId?: string; planCode?: string }) {
    const existing = await this.tenantRepo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException(`El slug ${data.slug} ya está registrado`);

    const planCode = data.planCode || 'BASICO';
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} no existe`);

    const tenant = this.tenantRepo.create({
      name: data.name,
      slug: data.slug,
      taxId: data.taxId,
      active: true,
    });
    const savedTenant = await this.tenantRepo.save(tenant);

    const subscription = this.subRepo.create({
      tenantId: savedTenant.id,
      planId: plan.id,
      status: 'ACTIVE',
      startDate: new Date(),
    });
    await this.subRepo.save(subscription);
    await this.historyRepo.save(this.historyRepo.create({
      tenantId: savedTenant.id, planId: plan.id, action: 'SUBSCRIBE', notes: 'Alta de tenant',
    }));

    return this.findOne(savedTenant.id);
  }
}

