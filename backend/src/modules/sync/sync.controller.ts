import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, ValidationPipe, Request } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlanFeatureGuard, RequiresPlanFeature } from '../../common/tenancy/plan-features';
import { SyncService } from './sync.service';
import { ResolveConflictDto, SyncBatchDto } from './sync.dto';

const validation = new ValidationPipe({ transform: true, whitelist: true });

@Controller('sync')
@UseGuards(AuthGuard, TenantGuard, PlanFeatureGuard)
@RequiresPlanFeature('offlineOperations')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /** Recibe la cola de operaciones offline del dispositivo y la procesa en orden. */
  @Post('batch')
  batch(@Body(validation) dto: SyncBatchDto, @Request() req: any) {
    return this.syncService.processBatch(req.user, dto);
  }

  @Get('operations')
  operations(@Request() req: any, @Query('ids') ids?: string) {
    return this.syncService.findMyOperations(req.user, ids ? ids.split(',') : undefined);
  }

  @Get('conflicts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ENCARGADO')
  conflicts(@Request() req: any, @Query('status') status?: string) {
    return this.syncService.findConflicts(req.user, status);
  }

  @Patch('conflicts/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ENCARGADO')
  resolve(@Param('id', ParseIntPipe) id: number, @Body(validation) dto: ResolveConflictDto, @Request() req: any) {
    return this.syncService.resolveConflict(id, dto, req.user);
  }
}
