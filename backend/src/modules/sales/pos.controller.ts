/**
 * POS CONTROLLER
 * Flujo POS (Punto de Venta para el Cajero): Expone las rutas /pos/sales 
 * y /pos/clients usadas por el cajero en la sucursal física.
 */
import { Controller, Get, Post, Body, UseGuards, Req, Query, Param, ParseIntPipe } from '@nestjs/common';
import { PosService } from './pos.service';
import { CreatePosSaleDto, CreatePosClientDto } from './sales.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('pos')
@UseGuards(AuthGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('products')
  getPosProducts(@Req() req: any) {
    const userId = req.user.sub;
    return this.posService.getPosProducts(userId);
  }

  @Get('clients')
  searchClients(@Req() req: any, @Query('search') search: string) {
    const userId = req.user.sub;
    return this.posService.searchClients(userId, search || '');
  }

  @Post('clients')
  createPosClient(@Req() req: any, @Body() dto: CreatePosClientDto) {
    const userId = req.user.sub;
    return this.posService.createPosClient(userId, dto);
  }

  /** Estado del cobro por QR (el cajero lo consulta cada pocos segundos). */
  @Get('sales/:id/payment')
  qrStatus(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.posService.getQrSaleStatus(req.user.sub, id);
  }

  /** Cancela un cobro QR pendiente y libera el stock reservado. */
  @Post('sales/:id/cancel-qr')
  cancelQr(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.posService.cancelQrSale(req.user.sub, id);
  }

  @Post('sales')
  createPosSale(@Req() req: any, @Body() dto: CreatePosSaleDto) {
    const userId = req.user.sub;
    return this.posService.createPosSale(userId, dto);
  }
}
