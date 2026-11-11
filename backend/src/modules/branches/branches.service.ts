import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { assertPlanLimit } from '../../common/tenancy/plan-features';
import { Branch } from './branch.entity';
import { City } from './city.entity';
import { CreateBranchDto, UpdateBranchDto } from './branches.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createBranchDto: CreateBranchDto & { tenantId?: number }) {
    const city = await this.cityRepository.findOneBy({ id: createBranchDto.cityId });
    if (!city) {
      throw new NotFoundException(`City with id ${createBranchDto.cityId} not found`);
    }

    const tenantId = createBranchDto.tenantId!;
    // Límite de sucursales según el plan contratado (y vigencia de la suscripción)
    await assertPlanLimit(this.dataSource, tenantId, 'branches');

    const branch = this.branchRepository.create({
      ...createBranchDto,
      tenantId,
    });
    return await this.branchRepository.save(branch);
  }

  async findAll(tenantId?: number) {
    const whereClause: any = {};
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    return await this.branchRepository.find({
      where: whereClause,
      relations: { city: true },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number, tenantId?: number) {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    const branch = await this.branchRepository.findOne({
      where: whereClause,
      relations: { city: true },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    return branch;
  }

  async update(id: number, updateBranchDto: UpdateBranchDto, tenantId?: number) {
    const branch = await this.findOne(id, tenantId);
    
    if (updateBranchDto.cityId) {
      const city = await this.cityRepository.findOneBy({ id: updateBranchDto.cityId });
      if (!city) {
        throw new NotFoundException(`City with id ${updateBranchDto.cityId} not found`);
      }
    }

    Object.assign(branch, updateBranchDto);
    return await this.branchRepository.save(branch);
  }

  async remove(id: number, tenantId?: number) {
    const branch = await this.findOne(id, tenantId);
    branch.active = false;
    return await this.branchRepository.save(branch);
  }
}
