import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PlanFeatureGuard, RequiresPlanFeature } from '../../common/tenancy/plan-features';

@Controller('reports')
@RequiresPlanFeature('basicReports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @UseGuards(AuthGuard, PlanFeatureGuard)
  getSalesReport(@Query() query: any, @Request() req: any) {
    return this.reportsService.getSalesReport(query, req.user);
  }

  @Get('products')
  @UseGuards(AuthGuard, PlanFeatureGuard)
  getProductsReport(@Query() query: any, @Request() req: any) {
    return this.reportsService.getProductsReport(query, req.user);
  }

  @Get('inventory')
  @UseGuards(AuthGuard, PlanFeatureGuard)
  getInventoryReport(@Query() query: any, @Request() req: any) {
    return this.reportsService.getInventoryReport(query, req.user);
  }

  @Get('reservations')
  @UseGuards(AuthGuard, PlanFeatureGuard)
  getReservationsReport(@Query() query: any, @Request() req: any) {
    return this.reportsService.getReservationsReport(query, req.user);
  }
}
