import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlanFeatureGuard, RequiresPlanFeature } from '../../common/tenancy/plan-features';
import { AiReportsService } from './ai-reports.service';

@Controller('ai-reports')
@UseGuards(AuthGuard, TenantGuard, RolesGuard, PlanFeatureGuard)
@Roles('ADMIN', 'ENCARGADO')
@RequiresPlanFeature('aiGenerativeReports')
export class AiReportsController {
  constructor(private readonly service: AiReportsService) {}

  @Get('suggestions')
  suggestions() {
    return this.service.getSuggestions();
  }

  @Post('query')
  query(@Body() body: { question: string }, @Request() req: any) {
    return this.service.generate(body?.question, req.user);
  }

  @Get('history')
  history(@Request() req: any) {
    return this.service.history(req.user);
  }
}
