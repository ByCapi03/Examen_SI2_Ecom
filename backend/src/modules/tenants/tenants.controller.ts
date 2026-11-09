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
  changePlan(@CurrentTenant() tenantId: number, @Body() body: { planCode: string }) {
    return this.tenantsService.changePlan(tenantId, body.planCode);
  }

  @Get('plans')
  @Public()
  plans() {
    return this.tenantsService.findAllPlans();
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
    name: string; slug: string; taxId?: string; planCode?: string;
    adminName?: string; adminEmail?: string; adminPassword?: string;
  }) {
    return this.tenantsService.createTenant(body);
  }
}
