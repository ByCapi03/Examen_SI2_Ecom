/**
 * CASH REGISTERS SERVICE
 * Alta y administración de las cajas de cada sucursal. ADMIN gestiona todas; ENCARGADO solo las de su sucursal.
 */
import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CashRegister } from './cash-register.entity';
import { CashSession } from './cash-session.entity';
import { CashSessionStatus } from './sales.enums';
import { Branch } from '../branches/branch.entity';
import { CreateCashRegisterDto, UpdateCashRegisterDto } from './sales.dto';

@Injectable()
export class CashRegistersService {
  constructor(
    @InjectRepository(CashRegister) private registerRepository: Repository<CashRegister>,
    @InjectRepository(CashSession) private sessionRepository: Repository<CashSession>,
    @InjectRepository(Branch) private branchRepository: Repository<Branch>,
  ) {}

  private assertManager(actor: any) {
    if (!actor.roles?.includes('ADMIN') && !actor.roles?.includes('ENCARGADO')) {
      throw new ForbiddenException('Solo el administrador o el encargado pueden gestionar cajas');
    }
    if (!actor.roles.includes('ADMIN') && !actor.branchId) {
      throw new ForbiddenException('No tienes una sucursal asignada');
    }
  }

  private async getScopedRegister(actor: any, id: number) {
    const register = await this.registerRepository.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!register) throw new NotFoundException('Caja no encontrada');
    if (!actor.roles.includes('ADMIN') && register.branchId !== actor.branchId) {
      throw new ForbiddenException('No puedes gestionar cajas de otra sucursal');
    }
    return register;
  }

  private rethrowUnique(error: any): never {
    if (error?.code === '23505') throw new ConflictException('Ya existe una caja con ese nombre en la sucursal');
    throw error;
  }

  async findAll(actor: any) {
    this.assertManager(actor);
    const where: any = { tenantId: actor.tenantId };
    if (!actor.roles.includes('ADMIN')) where.branchId = actor.branchId;

    const registers = await this.registerRepository.find({ where, relations: { branch: true }, order: { branchId: 'ASC', name: 'ASC' } });
    const open = registers.length
      ? await this.sessionRepository.find({
          where: { tenantId: actor.tenantId, status: CashSessionStatus.OPEN, registerId: In(registers.map((r) => r.id)) },
          relations: { cashier: true },
        })
      : [];
    const byRegister = new Map(open.map((s) => [s.registerId, s]));

    return registers.map((r) => {
      const s = byRegister.get(r.id);
      return {
        id: r.id,
        name: r.name,
        active: r.active,
        branchId: r.branchId,
        branchName: r.branch?.name ?? '',
        currentSession: s
          ? {
              id: s.id,
              cashierId: s.cashierId,
              cashierName: s.cashier?.name ?? 'Cajero',
              openedAt: s.openedAt,
              openingAmount: Number(s.openingAmount),
              assigned: !!s.openedById && s.openedById !== s.cashierId,
            }
          : null,
      };
    });
  }

  /** Cajas activas y libres de la sucursal del usuario (para que el cajero elija dónde abrir). */
  async findAvailableForUser(actor: any) {
    if (!actor.branchId) return [];
    const registers = await this.registerRepository.find({
      where: { tenantId: actor.tenantId, branchId: actor.branchId, active: true },
      order: { name: 'ASC' },
    });
    if (!registers.length) return [];
    const busy = new Set(
      (await this.sessionRepository.find({ where: { tenantId: actor.tenantId, status: CashSessionStatus.OPEN, registerId: In(registers.map((r) => r.id)) } }))
        .map((s) => s.registerId),
    );
    return registers.filter((r) => !busy.has(r.id)).map((r) => ({ id: r.id, name: r.name }));
  }

  async create(actor: any, dto: CreateCashRegisterDto) {
    this.assertManager(actor);
    const branchId = actor.roles.includes('ADMIN') ? dto.branchId : actor.branchId;
    if (!branchId) throw new BadRequestException('Indica la sucursal de la caja');
    const branch = await this.branchRepository.findOne({ where: { id: branchId, tenantId: actor.tenantId } });
    if (!branch || !branch.active) throw new BadRequestException('La sucursal no existe o está inactiva');

    try {
      return await this.registerRepository.save(
        this.registerRepository.create({ tenantId: actor.tenantId, branchId: branch.id, name: dto.name.trim(), active: true }),
      );
    } catch (error) {
      return this.rethrowUnique(error);
    }
  }

  async update(actor: any, id: number, dto: UpdateCashRegisterDto) {
    this.assertManager(actor);
    const register = await this.getScopedRegister(actor, id);

    if (dto.active === false && register.active) {
      const open = await this.sessionRepository.count({ where: { registerId: register.id, status: CashSessionStatus.OPEN } });
      if (open > 0) throw new BadRequestException('Cierra el turno abierto antes de desactivar la caja');
    }
    if (dto.name !== undefined) register.name = dto.name.trim();
    if (dto.active !== undefined) register.active = dto.active;

    try {
      return await this.registerRepository.save(register);
    } catch (error) {
      return this.rethrowUnique(error);
    }
  }

  async remove(actor: any, id: number) {
    this.assertManager(actor);
    const register = await this.getScopedRegister(actor, id);
    const used = await this.sessionRepository.count({ where: { registerId: register.id } });
    if (used > 0) throw new BadRequestException('La caja ya tiene turnos registrados: desactívala en lugar de eliminarla');
    await this.registerRepository.delete(register.id);
    return { success: true };
  }
}
