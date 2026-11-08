/**
 * SYNC SERVICE — Motor de sincronización offline
 *
 * Flujo por operación (idempotente y atómico):
 *   1. "Reclamar" la operación insertando (tenantId, operationId) en la bitácora.
 *      Si la clave ya existe → DUPLICATE: se devuelve el resultado original
 *      (reintentos de red nunca duplican ventas ni reservas).
 *   2. Aplicar la operación dentro de una transacción con bloqueo pesimista
 *      del inventario, aplicando las reglas de sync.rules.ts.
 *   3. Registrar conflictos detectados y el resultado final.
 *   4. Si ocurre un error técnico (no de negocio) se libera el reclamo para
 *      permitir el reintento.
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  SyncConflict, SyncConflictStatus, SyncConflictType, SyncOperation, SyncOperationStatus, SyncOperationType,
} from './sync.entities';
import { OfflineOperationDto, ResolveConflictDto, SyncBatchDto } from './sync.dto';
import { canFulfillReservation, priceDiffers, resolveOfflineSaleStock, sortOperations } from './sync.rules';
import { User } from '../auth/user.entity';
import { Inventory } from '../inventory/inventory.entity';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { MovementType } from '../inventory/inventory.enums';
import { CashSession } from '../sales/cash-session.entity';
import { Sale } from '../sales/sale.entity';
import { SaleItem } from '../sales/sale-item.entity';
import { Payment } from '../sales/payment.entity';
import { Client } from '../clients/client.entity';
import { CashSessionStatus, PaymentMethod, PaymentStatus, SaleChannel, SaleStatus } from '../sales/sales.enums';
import { CatalogPricingService } from '../catalog/catalog-pricing.service';
import { ReservationsService } from '../reservations/reservations.service';
import { Reservation } from '../reservations/reservation.entity';

export interface OperationOutcome {
  operationId: string;
  type: SyncOperationType;
  status: SyncOperationStatus | 'DUPLICATE';
  message: string;
  result?: any;
  conflicts?: { type: SyncConflictType; message: string; detail?: any }[];
}

class BusinessRejection extends Error {
  constructor(message: string, public readonly conflictType: SyncConflictType, public readonly detail?: any) {
    super(message);
  }
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SyncOperation) private readonly opRepo: Repository<SyncOperation>,
    @InjectRepository(SyncConflict) private readonly conflictRepo: Repository<SyncConflict>,
    private readonly pricing: CatalogPricingService,
    private readonly reservationsService: ReservationsService,
  ) {}

  async processBatch(user: any, dto: SyncBatchDto) {
    const ordered = sortOperations(dto.operations || []);
    const results: OperationOutcome[] = [];
    for (const op of ordered) {
      results.push(await this.processOne(user, op, dto.deviceId ?? null));
    }
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    return { serverTime: new Date().toISOString(), summary, results };
  }

  private async processOne(user: any, op: OfflineOperationDto, deviceId: string | null): Promise<OperationOutcome> {
    const tenantId = Number(user.tenantId);

    // 1. Idempotencia: ¿ya se procesó?
    const existing = await this.opRepo.findOne({ where: { tenantId, operationId: op.operationId } });
    if (existing && existing.status !== SyncOperationStatus.PROCESSING) {
      return {
        operationId: op.operationId, type: existing.type, status: 'DUPLICATE',
        message: 'Operación ya sincronizada previamente', result: existing.result,
      };
    }
    if (existing) {
      return { operationId: op.operationId, type: op.type, status: 'DUPLICATE', message: 'Operación en proceso por otra solicitud' };
    }

    // 2. Reclamar la operación (la UNIQUE (tenantId, operationId) evita carreras)
    let claim: SyncOperation;
    try {
      claim = await this.opRepo.save(this.opRepo.create({
        tenantId, operationId: op.operationId, type: op.type, status: SyncOperationStatus.PROCESSING,
        deviceId, userId: user.sub, payload: op, clientCreatedAt: new Date(op.clientCreatedAt),
      }));
    } catch {
      return { operationId: op.operationId, type: op.type, status: 'DUPLICATE', message: 'Operación ya registrada' };
    }

    try {
      let outcome: OperationOutcome;
      if (op.type === SyncOperationType.POS_CASH_SALE) {
        outcome = await this.applyOfflineCashSale(user, op);
      } else if (op.type === SyncOperationType.RESERVATION) {
        outcome = await this.applyOfflineReservation(user, op);
      } else {
        throw new BusinessRejection('Tipo de operación no soportado', SyncConflictType.INVALID_DATA);
      }
      claim.status = outcome.status as SyncOperationStatus;
      claim.result = { ...outcome.result, conflicts: outcome.conflicts ?? [] };
      await this.opRepo.save(claim);
      return outcome;
    } catch (err) {
      if (err instanceof BusinessRejection || err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ForbiddenException) {
        const conflictType = err instanceof BusinessRejection ? err.conflictType : SyncConflictType.INVALID_DATA;
        const detail = err instanceof BusinessRejection ? err.detail : undefined;
        await this.conflictRepo.save(this.conflictRepo.create({
          tenantId, operationId: op.operationId, type: conflictType, branchId: op.branchId,
          message: err.message, detail,
        }));
        claim.status = SyncOperationStatus.REJECTED;
        claim.result = { reason: err.message, conflictType, detail };
        await this.opRepo.save(claim);
        return {
          operationId: op.operationId, type: op.type, status: SyncOperationStatus.REJECTED, message: err.message,
          conflicts: [{ type: conflictType, message: err.message, detail }],
        };
      }
      // Error técnico → liberar el reclamo para permitir reintento
      this.logger.error(`Error técnico sincronizando ${op.operationId}`, err as any);
      await this.opRepo.delete({ id: claim.id });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // VENTA EN EFECTIVO OFFLINE (POS)
  // ---------------------------------------------------------------------------
  private async applyOfflineCashSale(user: any, op: OfflineOperationDto): Promise<OperationOutcome> {
    const tenantId = Number(user.tenantId);
    if (!user.roles?.includes('CAJERO')) {
      throw new ForbiddenException('Solo un CAJERO puede sincronizar ventas POS offline');
    }
    if (!op.items?.length) throw new BusinessRejection('La venta no tiene ítems', SyncConflictType.INVALID_DATA);

    return this.dataSource.transaction(async (manager) => {
      const cashier = await manager.findOne(User, { where: { id: user.sub, tenantId } });
      if (!cashier?.branchId) throw new BusinessRejection('El cajero no tiene sucursal asignada', SyncConflictType.INVALID_DATA);
      const branchId = cashier.branchId;

      if (op.clientId) {
        const client = await manager.findOne(Client, { where: { id: op.clientId, tenantId } });
        if (!client) op.clientId = undefined;
      }

      const conflicts: OperationOutcome['conflicts'] = [];

      // Sesión de caja: la indicada por el dispositivo o la abierta actualmente
      let session: CashSession | null = null;
      if (op.cashSessionId) {
        session = await manager.findOne(CashSession, { where: { id: op.cashSessionId, cashierId: user.sub, tenantId } });
      }
      if (!session || session.status !== CashSessionStatus.OPEN) {
        const open = await manager.findOne(CashSession, { where: { cashierId: user.sub, tenantId, status: CashSessionStatus.OPEN } });
        if (session && session.status === CashSessionStatus.CLOSED) {
          conflicts.push({
            type: SyncConflictType.CASH_SESSION_CLOSED,
            message: `La caja #${session.id} ya estaba cerrada; el efectivo de esta venta debe conciliarse en el arqueo`,
            detail: { originalCashSessionId: session.id, reassignedTo: open?.id ?? null },
          });
        }
        session = open ?? session;
      }

      // Consolidar ítems y bloquear inventario en orden determinista (evita deadlocks)
      const consolidated = new Map<number, { quantity: number; unitPrice?: number }>();
      for (const it of op.items) {
        const prev = consolidated.get(it.variantId);
        consolidated.set(it.variantId, { quantity: (prev?.quantity ?? 0) + it.quantity, unitPrice: it.unitPrice ?? prev?.unitPrice });
      }
      const variantIds = [...consolidated.keys()].sort((a, b) => a - b);

      let total = 0;
      const saleItems: Partial<SaleItem>[] = [];
      const touched: { inv: Inventory; deducted: number }[] = [];

      for (const variantId of variantIds) {
        const { quantity, unitPrice } = consolidated.get(variantId)!;
        const inv = await this.lockInventory(manager, tenantId, branchId, variantId);
        if (!inv) {
          throw new BusinessRejection(
            `La variante ${variantId} no existe en el inventario de la sucursal`,
            SyncConflictType.INVALID_DATA, { variantId },
          );
        }
        const current = this.pricing.getEffectivePrice(inv.variant.product).finalPrice;
        const charged = unitPrice ?? current;
        if (priceDiffers(charged, current)) {
          conflicts.push({
            type: SyncConflictType.PRICE_CHANGED,
            message: `Precio cobrado offline (${charged}) distinto al vigente (${current}) para ${inv.variant.product.name}`,
            detail: { variantId, chargedUnitPrice: charged, currentUnitPrice: current, quantity },
          });
        }
        const res = resolveOfflineSaleStock(quantity, inv.stock, inv.reserved);
        if (res.shortfall > 0 || res.affectsReservations) {
          conflicts.push({
            type: SyncConflictType.STOCK_SHORTFALL,
            message: `Se vendieron offline ${quantity} u. de ${inv.variant.product.name} (${inv.variant.sku}) ` +
              `con stock ${inv.stock} y ${inv.reserved} reservadas. Faltante: ${res.shortfall}`,
            detail: { variantId, sku: inv.variant.sku, requested: quantity, stockBefore: inv.stock, reserved: inv.reserved, ...res },
          });
        }
        inv.stock = res.newStock;
        await manager.save(Inventory, inv);
        touched.push({ inv, deducted: res.deducted });

        const subtotal = Number((charged * quantity).toFixed(2));
        total += subtotal;
        saleItems.push({ variantId, quantity, unitPrice: charged, subtotal });
      }
      total = Number(total.toFixed(2));

      const sale = await manager.save(Sale, manager.create(Sale, {
        tenantId,
        channel: SaleChannel.POS,
        status: SaleStatus.COMPLETADA,
        branchId,
        userId: user.sub,
        clientId: op.clientId ?? undefined,
        cashSessionId: session?.id ?? undefined,
        subtotal: total,
        total,
        offlineOperationId: op.operationId,
        date: new Date(op.clientCreatedAt),
      } as any) as unknown as Sale);

      for (const si of saleItems) {
        await manager.save(SaleItem, manager.create(SaleItem, { ...si, saleId: sale.id } as any));
      }
      await manager.save(Payment, manager.create(Payment, {
        tenantId, saleId: sale.id, amount: total, method: PaymentMethod.EFECTIVO, status: PaymentStatus.APROBADO,
        transactionReference: `OFFLINE-${op.operationId}`,
      } as any));
      for (const t of touched) {
        if (t.deducted > 0) {
          await manager.save(InventoryMovement, manager.create(InventoryMovement, {
            inventoryId: t.inv.id, type: MovementType.VENTA, quantity: t.deducted, userId: user.sub,
            observation: `Venta POS offline #${sale.id} (op ${op.operationId})`,
          }));
        }
      }

      for (const c of conflicts) {
        await manager.save(SyncConflict, manager.create(SyncConflict, {
          tenantId, operationId: op.operationId, type: c.type, branchId, saleId: sale.id,
          message: c.message, detail: c.detail,
        }));
      }

      return {
        operationId: op.operationId,
        type: op.type,
        status: conflicts.length ? SyncOperationStatus.APPLIED_WITH_CONFLICT : SyncOperationStatus.APPLIED,
        message: conflicts.length
          ? 'Venta registrada; se generaron conflictos para revisión del encargado'
          : 'Venta registrada correctamente',
        result: { saleId: sale.id, total, cashSessionId: session?.id ?? null },
        conflicts,
      };
    });
  }

  private lockInventory(manager: EntityManager, tenantId: number, branchId: number, variantId: number) {
    return manager.getRepository(Inventory).createQueryBuilder('inv')
      .innerJoinAndSelect('inv.variant', 'variant')
      .innerJoinAndSelect('variant.product', 'product')
      .leftJoinAndSelect('product.promotions', 'promotions')
      .leftJoinAndSelect('product.collection', 'collection')
      .where('inv.tenantId = :tenantId AND inv.branchId = :branchId AND inv.variantId = :variantId', { tenantId, branchId, variantId })
      .setLock('pessimistic_write', undefined, ['inv'])
      .getOne();
  }

  // ---------------------------------------------------------------------------
  // RESERVA OFFLINE (cliente web / móvil)
  // ---------------------------------------------------------------------------
  private async applyOfflineReservation(user: any, op: OfflineOperationDto): Promise<OperationOutcome> {
    const tenantId = Number(user.tenantId);
    if (!op.branchId || !op.date || !op.items?.length) {
      throw new BusinessRejection('Reserva incompleta (sucursal, fecha e ítems son obligatorios)', SyncConflictType.INVALID_DATA);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (op.date < today) {
      throw new BusinessRejection(`La fecha de la reserva (${op.date}) ya pasó`, SyncConflictType.INVALID_DATA, { date: op.date });
    }

    // Validación previa de stock: el servidor prevalece
    const shortages: any[] = [];
    for (const it of op.items) {
      const inv = await this.dataSource.getRepository(Inventory).findOne({
        where: { tenantId, branchId: op.branchId, variantId: it.variantId },
      });
      const stock = inv?.stock ?? 0;
      const reserved = inv?.reserved ?? 0;
      if (!canFulfillReservation(it.quantity, stock, reserved)) {
        const alternatives = await this.dataSource.query(
          `SELECT b.id AS "branchId", b.name AS "branchName", (i.stock - i.reserved) AS available
             FROM inventory i JOIN branches b ON b.id = i."branchId"
            WHERE i."tenantId" = $1 AND i."variantId" = $2 AND b.active = true
              AND (i.stock - i.reserved) >= $3 AND b.id <> $4
            ORDER BY available DESC LIMIT 3`,
          [tenantId, it.variantId, it.quantity, op.branchId],
        );
        shortages.push({ variantId: it.variantId, requested: it.quantity, available: Math.max(stock - reserved, 0), alternatives });
      }
    }
    if (shortages.length) {
      throw new BusinessRejection(
        'Sin stock suficiente al sincronizar la reserva; se sugieren sucursales alternativas',
        SyncConflictType.STOCK_UNAVAILABLE, { shortages },
      );
    }

    const created = await this.reservationsService.create({
      branchId: op.branchId, date: op.date, approximateTime: op.approximateTime,
      items: op.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      clientPlatform: op.clientPlatform ?? 'web',
    }, user);
    await this.dataSource.getRepository(Reservation).update(
      { id: created.reservationId, tenantId }, { offlineOperationId: op.operationId },
    );

    return {
      operationId: op.operationId, type: op.type, status: SyncOperationStatus.APPLIED,
      message: 'Reserva registrada. Complete el pago para confirmarla.', result: created,
    };
  }

  // ---------------------------------------------------------------------------
  // CONSULTA Y RESOLUCIÓN DE CONFLICTOS
  // ---------------------------------------------------------------------------
  async findConflicts(user: any, status?: string) {
    const where: any = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (user.roles?.includes('ENCARGADO') && !user.roles?.includes('ADMIN')) where.branchId = user.branchId;
    return this.conflictRepo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findMyOperations(user: any, operationIds?: string[]) {
    const where: any = { tenantId: user.tenantId, userId: user.sub };
    if (operationIds?.length) where.operationId = In(operationIds);
    return this.opRepo.find({ where, order: { receivedAt: 'DESC' }, take: 100 });
  }

  async resolveConflict(id: number, dto: ResolveConflictDto, user: any) {
    const tenantId = Number(user.tenantId);
    return this.dataSource.transaction(async (manager) => {
      const conflict = await manager.findOne(SyncConflict, { where: { id, tenantId } });
      if (!conflict) throw new NotFoundException('Conflicto no encontrado');
      if (conflict.status === SyncConflictStatus.RESUELTO) throw new BadRequestException('El conflicto ya fue resuelto');
      if (user.roles?.includes('ENCARGADO') && !user.roles?.includes('ADMIN') && conflict.branchId !== user.branchId) {
        throw new ForbiddenException('No puede resolver conflictos de otra sucursal');
      }

      if (dto.action === 'AJUSTAR_INVENTARIO') {
        if (conflict.type !== SyncConflictType.STOCK_SHORTFALL) throw new BadRequestException('Acción válida solo para faltantes de stock');
        // Se reconoce el faltante como merma/diferencia de inventario documentada.
        const inv = await manager.findOne(Inventory, {
          where: { tenantId, branchId: conflict.branchId, variantId: conflict.detail?.variantId },
        });
        if (inv) {
          await manager.save(InventoryMovement, manager.create(InventoryMovement, {
            inventoryId: inv.id, type: MovementType.AJUSTE, quantity: 0, userId: user.sub,
            observation: `Conciliación conflicto offline #${conflict.id}: faltante ${conflict.detail?.shortfall ?? 0} u. reconocido`,
          }));
        }
      }

      if (dto.action === 'ANULAR_VENTA') {
        if (!conflict.saleId) throw new BadRequestException('El conflicto no está asociado a una venta');
        const sale = await manager.findOne(Sale, { where: { id: conflict.saleId, tenantId }, relations: { items: true } });
        if (!sale) throw new NotFoundException('Venta no encontrada');
        if (sale.status !== SaleStatus.CANCELADA) {
          sale.status = SaleStatus.CANCELADA;
          await manager.save(Sale, sale);
          // Devolver al stock las unidades que sí se descontaron
          for (const item of sale.items) {
            const inv = await manager.findOne(Inventory, { where: { tenantId, branchId: sale.branchId, variantId: item.variantId } });
            if (!inv) continue;
            inv.stock += item.quantity;
            await manager.save(Inventory, inv);
            await manager.save(InventoryMovement, manager.create(InventoryMovement, {
              inventoryId: inv.id, type: MovementType.DEVOLUCION, quantity: item.quantity, userId: user.sub,
              observation: `Anulación venta offline #${sale.id} por conflicto #${conflict.id}`,
            }));
          }
        }
        // Cerrar también los demás conflictos abiertos de la misma operación
        await manager.update(SyncConflict,
          { tenantId, operationId: conflict.operationId, status: SyncConflictStatus.PENDIENTE },
          { status: SyncConflictStatus.RESUELTO, resolutionAction: 'ANULAR_VENTA', resolvedBy: user.sub, resolvedAt: new Date() });
      }

      conflict.status = SyncConflictStatus.RESUELTO;
      conflict.resolutionAction = dto.action;
      conflict.resolutionNotes = dto.notes ?? null;
      conflict.resolvedBy = user.sub;
      conflict.resolvedAt = new Date();
      return manager.save(SyncConflict, conflict);
    });
  }
}
