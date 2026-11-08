/**
 * SALES CONTROLLER
 * Flujo de Ventas Generales: Expone rutas generales, como /sales/my 
 * (para que el cliente vea su historial de compras en la app).
 */
import { Controller, Get, Post, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { SalesService } from './sales.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('sales')
@UseGuards(AuthGuard, TenantGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('checkout')
  checkoutWeb(@Body() body: any, @Request() req: any) {
    return this.salesService.checkoutWeb(body, req.user);
  }

  @Post(':saleId/cancel-pending')
  cancelPendingSale(@Param('saleId') saleId: string, @Request() req: any) {
    return this.salesService.cancelPendingSale(+saleId, req.user);
  }

  @Get('my')
  findMySales(@Request() req: any) {
    return this.salesService.findMySales(req.user);
  }

  @Get('my/:id')
  findOneMySale(@Param('id') id: string, @Request() req: any) {
    return this.salesService.findOneMySale(+id, req.user);
  }

  @Get()
  findAllSales(@Query() query: any, @Request() req: any) {
    return this.salesService.findAllSales(query, req.user);
  }

  @Get(':id')
  findOneSale(@Param('id') id: string, @Request() req: any) {
    return this.salesService.findOneSale(+id, req.user);
  }
}
