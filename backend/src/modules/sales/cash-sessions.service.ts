/**
 * CASH SESSIONS SERVICE
 * Flujo de Caja (Turnos): Verifica que un cajero no pueda abrir dos cajas a la vez 
 * y hace la matemática para el cierre de caja (esperado vs reportado).
 */
import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CashRegister } from './cash-register.entity';
import { CashSession } from './cash-session.entity';
import { User } from '../auth/user.entity';
import { Branch } from '../branches/branch.entity';
import { OpenCashSessionDto, CloseCashSessionDto } from './sales.dto';
import { CashSessionStatus, PaymentStatus, SaleStatus, PaymentMethod } from './sales.enums';
import { Payment } from './payment.entity';


@Injectable()
export class CashSessionsService {
  constructor(
    @InjectRepository(CashSession) private cashSessionRepository: Repository<CashSession>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Branch) private branchRepository: Repository<Branch>,
    @InjectRepository(CashRegister) private registerRepository: Repository<CashRegister>,
  ) {}

  private async getValidCashierAndBranch(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { userRoles: { role: true } }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario inválido o inactivo');
    }

    const isCashier = user.userRoles.some(ur => ur.role.name === 'CAJERO' && ur.active);
    if (!isCashier) {
      throw new UnauthorizedException('El usuario no tiene el rol CAJERO activo');
    }

    if (!user.branchId) {
      throw new BadRequestException('El cajero no tiene una sucursal asignada');
    }

    const branch = await this.branchRepository.findOne({ where: { id: user.branchId, tenantId: user.tenantId } });
    if (!branch || !branch.active) {
      throw new BadRequestException('La sucursal asignada no existe o está inactiva');
    }

    return { user, branch };
  }

  async openSession(userId: number, dto: OpenCashSessionDto) {
    const { user, branch } = await this.getValidCashierAndBranch(userId);

    const existingOpenSession = await this.cashSessionRepository.findOne({
      where: { cashierId: user.id, status: CashSessionStatus.OPEN }
    });

    if (existingOpenSession) {
      throw new ConflictException('Ya tienes una caja abierta. Ciérrala antes de abrir una nueva.');
    }

    const registerId = await this.pickRegisterForCashier(branch.id, dto.registerId);

    const newSession = this.cashSessionRepository.create({
      branchId: branch.id,
      cashierId: user.id,
      registerId,
      openingAmount: dto.openingAmount,
      openedById: user.id,
      status: CashSessionStatus.OPEN
    });

    try {
      return await this.cashSessionRepository.save(newSession);
    } catch (error: any) {
      this.rethrowOpenConflict(error, 'Ya tienes una caja abierta. Ciérrala antes de abrir una nueva.');
    }
  }

  private rethrowOpenConflict(error: any, cashierMessage: string): never {
    // Postgres unique constraint violation: distingue turno del cajero vs. caja ya en uso
    if (error?.code === '23505') {
      throw new ConflictException(String(error.constraint ?? '').includes('REGISTER') ? 'Esa caja ya está abierta' : cashierMessage);
    }
    throw error;
  }

  /** Elige la caja del turno: la indicada, o la única libre de la sucursal. */
  private async pickRegisterForCashier(branchId: number, requested?: number): Promise<number> {
    const registers = await this.registerRepository.find({ where: { branchId, active: true }, order: { name: 'ASC' } });
    if (!registers.length) {
      const any = await this.registerRepository.count({ where: { branchId } });
      throw new BadRequestException(any
        ? 'Las cajas de tu sucursal están desactivadas. Contacta a la administración.'
        : 'Tu sucursal aún no tiene cajas creadas. Pide a la administración que cree una.');
    }
    const busy = new Set(
      (await this.cashSessionRepository.find({ where: { branchId, status: CashSessionStatus.OPEN } })).map((s) => s.registerId),
    );
    if (requested) {
      const register = registers.find((r) => r.id === requested);
      if (!register) throw new BadRequestException('La caja seleccionada no es válida para tu sucursal');
      if (busy.has(register.id)) throw new ConflictException('Esa caja ya está en uso');
      return register.id;
    }
    const free = registers.filter((r) => !busy.has(r.id));
    if (!free.length) throw new ConflictException('Todas las cajas de tu sucursal están en uso');
    if (free.length === 1) return free[0].id;
    throw new BadRequestException('Selecciona la caja que vas a usar');
  }

  private async calculateSessionSummary(sessionId: number) {
    const payments = await this.cashSessionRepository.manager
      .createQueryBuilder(Payment, 'payment')
      .innerJoin('payment.sale', 'sale')
      .where('sale.cashSessionId = :sessionId', { sessionId })
      .andWhere('payment.status = :paymentStatus', { paymentStatus: PaymentStatus.APROBADO })
      .andWhere('sale.status IN (:...saleStatuses)', { saleStatuses: [SaleStatus.COMPLETADA, SaleStatus.PAGADA] })
      .select('payment.method', 'method')
      .addSelect('SUM(payment.amount)', 'total')
      .groupBy('payment.method')
      .getRawMany();

    let cashSales = 0;
    let cardSales = 0;
    let qrSales = 0;

    payments.forEach(p => {
      const total = Number(p.total) || 0;
      switch (p.method) {
        case PaymentMethod.EFECTIVO:
          cashSales += total;
          break;
        case PaymentMethod.TARJETA:
          cardSales += total;
          break;
        case PaymentMethod.QR:
        case PaymentMethod.BILLETERA_MOVIL:
          qrSales += total;
          break;
      }
    });

    const totalVendido = cashSales + cardSales + qrSales;

    return {
      cashSales,
      cardSales,
      qrSales,
      totalVendido
    };
  }

  async getCurrentSession(userId: number) {
    const { user, branch } = await this.getValidCashierAndBranch(userId);

    const openSession = await this.cashSessionRepository.findOne({
      where: { cashierId: user.id, status: CashSessionStatus.OPEN },
      relations: { register: true },
    });

    if (openSession) {
      const summary = await this.calculateSessionSummary(openSession.id);
      const expectedAmount = Number(openSession.openingAmount) + summary.cashSales;

      return {
        status: 'OPEN',
        session: {
          id: openSession.id,
          registerName: openSession.register?.name ?? null,
          openingAmount: openSession.openingAmount,
          openedAt: openSession.openedAt,
          summary: {
            ...summary,
            expectedAmount
          }
        },
        branch: {
          id: branch.id,
          code: branch.id.toString(),
          name: branch.name
        }
      };
    }

    return {
      status: 'CLOSED',
      session: null,
      branch: {
        id: branch.id,
        code: branch.id.toString(),
        name: branch.name
      }
    };
  }

  private async finalizeSession(session: CashSession, closingAmount: number, closedById: number) {
    const summary = await this.calculateSessionSummary(session.id);
    const expectedAmount = Number(session.openingAmount) + summary.cashSales;

    session.closingAmount = closingAmount;
    session.expectedAmount = expectedAmount;
    session.difference = closingAmount - expectedAmount;
    session.closedAt = new Date();
    session.closedById = closedById;
    session.status = CashSessionStatus.CLOSED;

    return await this.cashSessionRepository.save(session);
  }

  async closeSession(userId: number, dto: CloseCashSessionDto) {
    const { user } = await this.getValidCashierAndBranch(userId);

    const openSession = await this.cashSessionRepository.findOne({
      where: { cashierId: user.id, status: CashSessionStatus.OPEN }
    });

    if (!openSession) {
      throw new BadRequestException('No tienes una caja abierta para cerrar.');
    }

    return this.finalizeSession(openSession, dto.closingAmount, user.id);
  }

  private assertManager(actor: any) {
    if (!actor.roles?.includes('ADMIN') && !actor.roles?.includes('ENCARGADO')) {
      throw new ForbiddenException('Solo el administrador o el encargado pueden gestionar cajas de otros cajeros');
    }
  }

  /** ADMIN/ENCARGADO abren un turno sobre una caja existente, a nombre de un cajero de esa sucursal. */
  async openSessionAsManager(actor: any, dto: OpenCashSessionDto) {
    this.assertManager(actor);
    const isAdmin = actor.roles.includes('ADMIN');
    if (!dto.registerId) throw new BadRequestException('Selecciona la caja que se va a abrir');
    if (!dto.cashierId) throw new BadRequestException('Selecciona el cajero que usará la caja');

    const register = await this.registerRepository.findOne({
      where: { id: dto.registerId, tenantId: actor.tenantId },
      relations: { branch: true },
    });
    if (!register) throw new NotFoundException('La caja no existe');
    if (!isAdmin && register.branchId !== actor.branchId) throw new ForbiddenException('No puedes abrir cajas de otra sucursal');
    if (!register.active) throw new BadRequestException('La caja está desactivada');
    if (!register.branch?.active) throw new BadRequestException('La sucursal de la caja está inactiva');

    const cashier = await this.userRepository.findOne({
      where: { id: dto.cashierId, tenantId: actor.tenantId },
      relations: { userRoles: { role: true } },
    });
    if (!cashier || !cashier.active || !cashier.userRoles.some((ur) => ur.role.name === 'CAJERO' && ur.active)) {
      throw new BadRequestException('El usuario seleccionado no es un cajero activo');
    }
    if (cashier.branchId !== register.branchId) {
      throw new BadRequestException('El cajero no pertenece a la sucursal de esta caja');
    }

    if (await this.cashSessionRepository.findOne({ where: { registerId: register.id, status: CashSessionStatus.OPEN } })) {
      throw new ConflictException('Esta caja ya está abierta');
    }
    if (await this.cashSessionRepository.findOne({ where: { cashierId: cashier.id, status: CashSessionStatus.OPEN } })) {
      throw new ConflictException(`${cashier.name} ya tiene una caja abierta`);
    }

    try {
      return await this.cashSessionRepository.save(this.cashSessionRepository.create({
        branchId: register.branchId,
        registerId: register.id,
        cashierId: cashier.id,
        openingAmount: dto.openingAmount,
        openedById: actor.sub,
        status: CashSessionStatus.OPEN,
      }));
    } catch (error: any) {
      this.rethrowOpenConflict(error, `${cashier.name} ya tiene una caja abierta`);
    }
  }

  /** ADMIN/ENCARGADO cierran cualquier caja abierta de su alcance (cierre administrativo). */
  async closeSessionAsManager(actor: any, sessionId: number, dto: CloseCashSessionDto) {
    this.assertManager(actor);
    const session = await this.cashSessionRepository.findOne({ where: { id: sessionId, tenantId: actor.tenantId } });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    if (!actor.roles.includes('ADMIN') && session.branchId !== actor.branchId) {
      throw new ForbiddenException('No puedes cerrar cajas de otra sucursal');
    }
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException('Esta caja ya está cerrada');
    return this.finalizeSession(session, dto.closingAmount, actor.sub);
  }

  async findAll(user: any, branchId?: string) {
    const isAdmin = user.roles?.includes('ADMIN');
    const isEncargado = user.roles?.includes('ENCARGADO');

    if (!isAdmin && !isEncargado) {
      throw new UnauthorizedException('No tiene permisos para ver las sesiones de caja');
    }

    let whereClause: any = { tenantId: user.tenantId };
    if (isEncargado) {
      whereClause.branchId = user.branchId;
    } else if (isAdmin && branchId) {
      whereClause.branchId = Number(branchId);
    }

    const sessions = await this.cashSessionRepository.find({
      where: whereClause,
      relations: { cashier: true, branch: true, register: true },
      order: { openedAt: 'DESC' }
    });

    return Promise.all(sessions.map(async (s) => {
      // En cajas abiertas, el esperado se calcula en vivo (apertura + ventas en efectivo).
      let expectedAmount = s.expectedAmount !== null && s.expectedAmount !== undefined ? Number(s.expectedAmount) : null;
      if (s.status === CashSessionStatus.OPEN) {
        try {
          const summary = await this.calculateSessionSummary(s.id);
          expectedAmount = Number(s.openingAmount) + summary.cashSales;
        } catch {
          expectedAmount = Number(s.openingAmount); // un resumen fallido no debe tumbar todo el listado
        }
      }
      return {
        id: s.id,
        cashierId: s.cashierId,
        branchId: s.branchId,
        registerId: s.registerId,
        registerName: s.register?.name ?? null,
        cashierName: s.cashier?.name || 'Cajero',
        branchName: s.branch?.name || '',
        openingAmount: Number(s.openingAmount),
        closingAmount: s.closingAmount !== null && s.closingAmount !== undefined ? Number(s.closingAmount) : null,
        expectedAmount,
        difference: s.difference !== null && s.difference !== undefined ? Number(s.difference) : null,
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        assigned: !!s.openedById && s.openedById !== s.cashierId,
      };
    }));
  }
}
