/**
 * AUDIT CONTROLLER
 * /audit-logs: consulta, resumen, filtros y exportación CSV de la bitácora (solo ADMIN de la empresa).
 */
import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import type { AuditQuery } from './audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('audit-logs')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Req() req: any, @Query() query: AuditQuery) {
    return this.audit.list(req.user, query);
  }

  @Get('summary')
  summary(@Req() req: any) {
    return this.audit.summary(req.user);
  }

  @Get('filters')
  filters(@Req() req: any) {
    return this.audit.filters(req.user);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="bitacora.csv"')
  exportCsv(@Req() req: any, @Query() query: AuditQuery) {
    return this.audit.exportCsv(req.user, query);
  }
}
