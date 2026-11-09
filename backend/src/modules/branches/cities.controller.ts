/**
 * CIUDADES — Catálogo geográfico COMPARTIDO por todas las empresas del SaaS.
 * Cualquier empresa puede consultarlo y agregar una ciudad nueva, pero solo el
 * SUPERADMIN de la plataforma puede modificar o desactivar ciudades existentes,
 * para que una empresa no altere datos que usan las demás.
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CreateCityDto, UpdateCityDto } from './branches.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Post()
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('SUPERADMIN', 'ADMIN')
  create(@Body() createCityDto: CreateCityDto) {
    return this.citiesService.create(createCityDto);
  }

  @Get()
  findAll() {
    return this.citiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('SUPERADMIN')
  update(@Param('id') id: string, @Body() updateCityDto: UpdateCityDto) {
    return this.citiesService.update(+id, updateCityDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('SUPERADMIN')
  remove(@Param('id') id: string) {
    return this.citiesService.remove(+id);
  }
}
