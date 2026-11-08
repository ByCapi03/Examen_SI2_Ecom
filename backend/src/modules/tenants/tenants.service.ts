import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Subscription } from './subscription.entity';
import { Plan } from './plan.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(Plan) private planRepo: Repository<Plan>,
  ) {}

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

    return this.findOne(savedTenant.id);
  }
}

