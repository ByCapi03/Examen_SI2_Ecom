import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CompanyRegistrationService } from './company-registration.service';
import type { CompleteRegistrationDto } from './company-registration.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('saas')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly registration: CompanyRegistrationService,
  ) {}

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
  createTenant(@Body() body: { name: string; slug: string; taxId?: string; planCode?: string }) {
    return this.tenantsService.createTenant(body);
  }

  /** Registro público de empresa: slug sugerido único + disponibilidad del correo. */
  @Post('register/check')
  @Public()
  checkRegistration(@Body() body: { name: string; email?: string }) {
    return this.registration.checkAvailability(body.name, body.email);
  }

  /** Paso previo al pago: envía el código OTP al correo del administrador. */
  @Post('register/send-code')
  @Public()
  sendCode(@Body() body: { email: string }) {
    return this.registration.sendCode(body.email);
  }

  @Post('register/verify-code')
  @Public()
  verifyCode(@Body() body: { email: string; code: string }) {
    return this.registration.verifyCode(body.email, body.code);
  }

  /** Cobra (simulado) y crea empresa + suscripción + administrador en una transacción. */
  @Post('register/complete')
  @Public()
  completeRegistration(@Body() body: CompleteRegistrationDto) {
    return this.registration.complete(body);
  }
}
