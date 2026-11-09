/**
 * CASH SESSIONS CONTROLLER
 * Flujo de Caja (Turnos): Expone las rutas /cash-sessions/open, /cash-sessions/close, etc.
 */
import { Controller, Post, Get, Body, UseGuards, Req, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CashSessionsService } from './cash-sessions.service';
import { OpenCashSessionDto } from './sales.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('cash-sessions')
@UseGuards(AuthGuard)
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Post('open')
  openSession(@Req() req: any, @Body() openCashSessionDto: OpenCashSessionDto) {
    const userId = req.user.sub;
    const isManager = req.user.roles?.includes('ADMIN') || req.user.roles?.includes('ENCARGADO');
    return isManager
      ? this.cashSessionsService.openSessionAsManager(req.user, openCashSessionDto)
      : this.cashSessionsService.openSession(userId, openCashSessionDto);
  }

  @Get('current')
  getCurrentSession(@Req() req: any) {
    const userId = req.user.sub;
    return this.cashSessionsService.getCurrentSession(userId);
  }

  @Post('close')
  closeSession(@Req() req: any, @Body() closeCashSessionDto: import('./sales.dto').CloseCashSessionDto) {
    const userId = req.user.sub;
    return this.cashSessionsService.closeSession(userId, closeCashSessionDto);
  }

  @Post(':id/close')
  closeSessionAsManager(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: import('./sales.dto').CloseCashSessionDto) {
    return this.cashSessionsService.closeSessionAsManager(req.user, id, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query('branchId') branchId?: string) {
    return this.cashSessionsService.findAll(req.user, branchId);
  }
}
