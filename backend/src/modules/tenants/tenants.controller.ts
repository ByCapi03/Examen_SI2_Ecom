import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('saas')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** Plataforma: solo el SUPERADMIN del SaaS puede ver todas las empresas. */
  @Get('tenants')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  findAll() {
    return this.tenantsService.findAll();
  }

  /** Empresa del usuario autenticado + plan contratado (para habilitar funciones en UI). */
  @Get('tenants/me')
  @UseGuards(AuthGuard, TenantGuard)
  me(@CurrentTenant() tenantId: number) {
    return this.tenantsService.getMyTenant(tenantId);
  }

  /** El ADMIN de la empresa cambia su propio plan (queda auditado). */
  @Patch('tenants/me/plan')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('ADMIN')
  changePlan(@CurrentTenant() tenantId: number, @Body() body: { planCode: string; billingCycle?: string }) {
    return this.tenantsService.changePlan(tenantId, body.planCode, body.billingCycle);
  }

  // ───── Panel de plataforma (solo SUPERADMIN) ─────
  @Get('admin/overview')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  adminOverview() { return this.tenantsService.adminOverview(); }

  @Get('admin/tenants')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  adminTenants() { return this.tenantsService.adminTenants(); }

  @Patch('admin/tenants/:id/active')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  adminSetActive(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.tenantsService.adminSetActive(+id, !!body.active);
  }

  @Patch('admin/tenants/:id/plan')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  adminChangePlan(@Param('id') id: string, @Body() body: { planCode: string; billingCycle?: string }) {
    return this.tenantsService.adminChangePlan(+id, body.planCode, body.billingCycle);
  }

  @Patch('admin/tenants/:id/extend')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  adminExtend(@Param('id') id: string, @Body() body: { days: number }) {
    return this.tenantsService.adminExtend(+id, body.days);
  }

  /** El ADMIN personaliza la web pública de su empresa. */
  @Patch('tenants/me/store')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('ADMIN')
  updateStore(@CurrentTenant() tenantId: number, @Body() body: any) {
    return this.tenantsService.updateStoreConfig(tenantId, body);
  }

  @Get('plans')
  @Public()
  plans() {
    return this.tenantsService.findAllPlans();
  }

  @Get('tenants/by-slug/:slug')
  @Public()
  bySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlugPublic(slug);
  }

  @Get('tenants/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(+id);
  }

  @Post('tenants/register')
  @Public()
  createTenant(@Body() body: {
    name: string; slug: string; taxId?: string; planCode?: string; billingCycle?: string;
    adminName?: string; adminEmail?: string; adminPassword?: string;
  }) {
    return this.tenantsService.createTenant(body);
  }

  @Post('tenants/verify-email')
  @Public()
  verifyEmail(@Body() body: { email: string; code: string }) {
    return this.tenantsService.verifyEmail(body.email, body.code);
  }

  @Post('tenants/resend-code')
  @Public()
  resendCode(@Body() body: { email: string }) {
    return this.tenantsService.resendVerificationCode(body.email);
  }
}
