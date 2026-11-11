/**
 * NOTIFICATIONS CONTROLLER
 * Endpoints: Provee las rutas para que el usuario consulte sus notificaciones in-app 
 * (/notifications/my), las marque como leídas y registre su dispositivo (/notifications/device) 
 * para recibir push notifications.
 */
import { Controller, Get, Patch, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './notifications.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  findMyNotifications(@Req() req: any) {
    return this.notificationsService.findMyNotifications(req.user.sub);
  }

  /** Diagnóstico: ¿está listo el push del servidor y este usuario tiene dispositivos? */
  @Get('status')
  pushStatus(@Req() req: any) {
    return this.notificationsService.pushStatus(req.user.sub);
  }

  /** Revisa el stock crítico de la empresa y genera las alertas pendientes (idempotente: máx. 1 cada 24 h). */
  @Post('low-stock/sync')
  syncLowStock(@Req() req: any) {
    const roles: string[] = req.user.roles ?? [];
    if (!roles.includes('ADMIN') && !roles.includes('ENCARGADO')) return { branches: 0, notified: 0 };
    return this.notificationsService.syncLowStockAlerts(req.user.tenantId);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(+id, req.user.sub);
  }

  @Post('devices')
  registerDevice(@Body() dto: RegisterDeviceDto, @Req() req: any) {
    return this.notificationsService.registerDevice(req.user.sub, dto.token, dto.platform);
  }

  // TEMPORARY ENDPOINT FOR TESTING
  @Post('test')
  testPush(@Req() req: any) {
    return this.notificationsService.testPushNotification(req.user.sub);
  }
}
