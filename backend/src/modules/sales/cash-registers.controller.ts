/**
 * CASH REGISTERS CONTROLLER
 * /cash-registers: alta, listado, edición y baja de las cajas de una sucursal.
 */
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { CreateCashRegisterDto, UpdateCashRegisterDto } from './sales.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('cash-registers')
@UseGuards(AuthGuard)
export class CashRegistersController {
  constructor(private readonly cashRegistersService: CashRegistersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.cashRegistersService.findAll(req.user);
  }

  @Get('available')
  available(@Req() req: any) {
    return this.cashRegistersService.findAvailableForUser(req.user);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateCashRegisterDto) {
    return this.cashRegistersService.create(req.user, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashRegisterDto) {
    return this.cashRegistersService.update(req.user, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.cashRegistersService.remove(req.user, id);
  }
}
