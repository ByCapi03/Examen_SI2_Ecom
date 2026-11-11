import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { City } from './city.entity';
import { CreateCityDto, UpdateCityDto } from './branches.dto';

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  // Las ciudades son un catálogo compartido por todas las empresas: el nombre no puede repetirse.
  private async assertNameFree(name: string, exceptId?: number) {
    const clash = await this.cityRepository.findOne({
      where: { name: ILike(name.trim().replace(/[%_\\]/g, '\\$&')), ...(exceptId ? { id: Not(exceptId) } : {}) },
    });
    if (clash) throw new ConflictException(`La ciudad "${clash.name}" ya existe en el catálogo; selecciónala al crear la sucursal`);
  }

  async create(createCityDto: CreateCityDto) {
    await this.assertNameFree(createCityDto.name);
    const city = this.cityRepository.create(createCityDto);
    return await this.cityRepository.save(city);
  }

  async findAll() {
    return await this.cityRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const city = await this.cityRepository.findOneBy({ id });
    if (!city) {
      throw new NotFoundException(`City with id ${id} not found`);
    }
    return city;
  }

  async update(id: number, updateCityDto: UpdateCityDto) {
    const city = await this.findOne(id);
    if (updateCityDto.name) await this.assertNameFree(updateCityDto.name, id);
    Object.assign(city, updateCityDto);
    return await this.cityRepository.save(city);
  }

  async remove(id: number) {
    const city = await this.findOne(id);
    city.active = false;
    return await this.cityRepository.save(city);
  }
}
