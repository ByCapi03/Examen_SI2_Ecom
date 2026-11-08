import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlanFeatureGuard, RequiresPlanFeature } from '../../common/tenancy/plan-features';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AuthGuard, TenantGuard, RolesGuard, PlanFeatureGuard)
@Roles('ADMIN', 'ENCARGADO')
@RequiresPlanFeature('aiGenerativeReports')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('demand-forecast')
  demand(@Request() req: any, @Query() q: any) {
    return this.service.demandForecast(req.user, q);
  }

  @Get('customer-segments')
  segments(@Request() req: any, @Query('k') k?: string) {
    return this.service.customerSegments(req.user, { k: k ? Number(k) : undefined });
  }
}
