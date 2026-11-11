/**
 * POS SERVICE
 * Flujo POS (Punto de Venta para el Cajero): Contiene la lógica pesada de la caja. 
 * Se asegura de que el cajero tenga una caja abierta (CashSession) antes de vender, 
 * descuenta el inventario físico y crea al vuelo un cliente nuevo si no existía.
 */
import { getEffectiveTenantId } from '../../common/tenancy/tenant-context';
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { jwtSecret } from '../../common/config/jwt-secret';
import * as qrcode from 'qrcode';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, Or } from 'typeorm';

import { User } from '../auth/user.entity';
import { Branch } from '../branches/branch.entity';
import { Inventory } from '../inventory/inventory.entity';
import { Client } from '../clients/client.entity';
import { CashSession } from './cash-session.entity';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';
import { Payment } from './payment.entity';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { CatalogPricingService } from '../catalog/catalog-pricing.service';

import { CreatePosSaleDto, CreatePosClientDto } from './sales.dto';
import { SaleChannel, SaleStatus, PaymentStatus, CashSessionStatus, PaymentMethod } from './sales.enums';
import { MovementType } from '../inventory/inventory.enums';

/** Minutos que el cliente tiene para pagar un QR de POS antes de liberar el stock reservado. */
const POS_QR_TTL_MIN = 5;

@Injectable()
export class PosService implements OnModuleInit {
  private readonly logger = new Logger(PosService.name);

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Branch) private branchRepository: Repository<Branch>,
    @InjectRepository(Inventory) private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Client) private clientRepository: Repository<Client>,
    private dataSource: DataSource,
    private catalogPricingService: CatalogPricingService
  ) {}

  private async getValidCashierBranch(userId: number) {
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

    return branch.id;
  }

  async getPosProducts(userId: number) {
    const branchId = await this.getValidCashierBranch(userId);

    const inventories = await this.inventoryRepository.find({
      where: {
        branchId,
        variant: {
          active: true,
          product: { active: true }
        }
      },
      relations: {
        variant: {
          product: {
            collection: { season: true },
            promotions: true
          },
          size: true,
          color: true
        }
      }
    });

    const results = [];

    for (const inv of inventories) {
      const available = inv.stock - inv.reserved;
      if (available > 0) {
        const pricing = this.catalogPricingService.getEffectivePrice(inv.variant.product);
        results.push({
          productId: inv.variant.product.id,
          variantId: inv.variant.id,
          productName: inv.variant.product.name,
          imageUrl: inv.variant.product.imageUrl,
          sku: inv.variant.sku,
          size: inv.variant.size.name,
          color: inv.variant.color.name,
          price: pricing.basePrice,
          finalPrice: pricing.finalPrice,
          discount: pricing.discount,
          available
        });
      }
    }

    return results;
  }

  async createPosSale(userId: number, dto: CreatePosSaleDto) {
    const isQr = dto.paymentMethod === PaymentMethod.QR;
    // Basic verification without locking
    const branchId = await this.getValidCashierBranch(userId);

    // Consolidate and sort items
    const consolidatedMap = new Map<number, number>();
    for (const item of dto.items) {
      if (!consolidatedMap.has(item.variantId)) {
        consolidatedMap.set(item.variantId, 0);
      }
      consolidatedMap.set(item.variantId, (consolidatedMap.get(item.variantId) || 0) + item.quantity);
    }
    
    const consolidatedItems = Array.from(consolidatedMap.entries())
      .map(([variantId, quantity]) => ({ variantId, quantity }))
      .sort((a, b) => a.variantId - b.variantId);

    if (consolidatedItems.length === 0) {
      throw new BadRequestException('La venta debe tener al menos un item');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify Client if provided
      if (dto.clientId) {
        const client = await queryRunner.manager.findOne(Client, { where: { id: dto.clientId, tenantId: getEffectiveTenantId() } });
        if (!client) {
          throw new NotFoundException('Cliente no encontrado');
        }
      }

      // 2. Verify CashSession OPEN
      const openSession = await queryRunner.manager.findOne(CashSession, {
        where: { cashierId: userId, status: CashSessionStatus.OPEN }
      });
      if (!openSession) {
        throw new BadRequestException('No existe una sesión de caja abierta');
      }
      if (openSession.branchId !== branchId) {
        throw new BadRequestException('La sesión de caja no corresponde a la sucursal actual');
      }

      let total = 0;
      const saleItemsToSave = [];
      const inventoryMovementsToSave = [];
      const inventoriesToUpdate = [];

      // 3. Pessimistic lock per item using QueryBuilder with INNER JOINs
      // FIX: findOne with relations uses LEFT JOINs, which PostgreSQL rejects with FOR UPDATE (SQLSTATE 0A000).
      // Solution: use QueryBuilder with innerJoinAndSelect so all joins are INNER, compatible with FOR UPDATE.
      for (const item of consolidatedItems) {
        const inventory = await queryRunner.manager
          .getRepository(Inventory)
          .createQueryBuilder('inv')
          .innerJoinAndSelect('inv.variant', 'variant')
          .innerJoinAndSelect('variant.product', 'product')
          .leftJoinAndSelect('product.promotions', 'promotions')
          .leftJoinAndSelect('product.collection', 'collection')
          .where('inv.branchId = :branchId AND inv.variantId = :variantId', {
            branchId,
            variantId: item.variantId,
          })
          .setLock('pessimistic_write', undefined, ['inv']) // solo bloquea inventario (LEFT JOIN de promociones no admite FOR UPDATE)
          .getOne();

        if (!inventory) {
          throw new NotFoundException(`Inventario no encontrado para variante ${item.variantId} en esta sucursal`);
        }
        if (!inventory.variant.active || !inventory.variant.product.active) {
          throw new BadRequestException(`El producto de variante ${item.variantId} está inactivo`);
        }

        const available = inventory.stock - inventory.reserved;
        if (item.quantity <= 0) {
          throw new BadRequestException('La cantidad debe ser mayor a 0');
        }
        if (available < item.quantity) {
          throw new ConflictException(`Stock insuficiente para variante ${item.variantId}. Disponible: ${available}, Requerido: ${item.quantity}`);
        }

        // Calculation
        const pricing = this.catalogPricingService.getEffectivePrice(inventory.variant.product);
        const unitPriceNum = pricing.finalPrice; // Pos must use final price
        const subtotalNum = unitPriceNum * item.quantity;
        total += subtotalNum;

        // SaleItem preparation
        const saleItem = queryRunner.manager.create(SaleItem, {
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: unitPriceNum,
          subtotal: subtotalNum,
          saleId: 0
        });
        saleItemsToSave.push(saleItem);

        // Update inventory. Con QR el stock solo se RESERVA hasta que el cliente pague.
        if (isQr) inventory.reserved += item.quantity; else inventory.stock -= item.quantity;
        inventoriesToUpdate.push(inventory);

        // Inventory movement preparation
        const movement = queryRunner.manager.create(InventoryMovement, {
          inventoryId: inventory.id,
          type: isQr ? MovementType.RESERVA : MovementType.VENTA,
          quantity: item.quantity,
          userId,
          observation: isQr ? 'Reserva POS por pago QR' : 'Venta POS'
        });
        inventoryMovementsToSave.push(movement);
      }

      // 4. Create Sale
      const sale = queryRunner.manager.create(Sale, {
        channel: SaleChannel.POS,
        status: isQr ? SaleStatus.PENDIENTE : SaleStatus.COMPLETADA,
        branchId,
        userId,
        cashSessionId: openSession.id,
        clientId: dto.clientId ?? undefined,
        subtotal: total,
        total: total
      } as any);
      const savedSale = await queryRunner.manager.save(Sale, sale);

      // Save related entities
      for (const si of saleItemsToSave) {
        si.saleId = savedSale.id;
        await queryRunner.manager.save(SaleItem, si);
      }

      const payment = queryRunner.manager.create(Payment, {
        saleId: savedSale.id,
        amount: total,
        method: dto.paymentMethod,
        status: isQr ? PaymentStatus.PENDIENTE : PaymentStatus.APROBADO,
        ...(isQr ? { provider: 'DEMO_QR', expiresAt: new Date(Date.now() + POS_QR_TTL_MIN * 60_000), transactionReference: `POSQR-${savedSale.id}-${Date.now().toString(36).toUpperCase()}` } : {}),
      } as any);
      const savedPayment: any = await queryRunner.manager.save(Payment, payment);

      for (const inv of inventoriesToUpdate) {
        await queryRunner.manager.save(Inventory, inv);
      }

      for (const mov of inventoryMovementsToSave) {
        mov.observation = isQr ? `Reserva POS por pago QR (venta #${savedSale.id})` : `Venta POS #${savedSale.id}`;
        await queryRunner.manager.save(InventoryMovement, mov);
      }

      await queryRunner.commitTransaction();

      let qr: any = undefined;
      if (isQr) {
        const token = jwt.sign({ paymentId: savedPayment.id }, jwtSecret(), { expiresIn: `${POS_QR_TTL_MIN}m` } as any);
        const base = process.env.QR_PUBLIC_WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
        const confirmationUrl = `${base}/qr-payment/${token}`;
        qr = { paymentId: savedPayment.id, confirmationUrl, qrImage: await qrcode.toDataURL(confirmationUrl, { margin: 1, width: 320 }), expiresAt: savedPayment.expiresAt, reference: savedPayment.transactionReference };
      }
      return {
        qr,
        id: savedSale.id,
        total: savedSale.total,
        subtotal: savedSale.subtotal,
        channel: savedSale.channel,
        status: savedSale.status,
        branchId: savedSale.branchId,
        clientId: savedSale.clientId,
        cashSessionId: savedSale.cashSessionId,
        paymentMethod: dto.paymentMethod,
        date: savedSale.date,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async searchClients(userId: number, search: string) {
    await this.getValidCashierBranch(userId);

    const q = (search || '').trim();
    if (!q) {
      // Return recent clients if no search query
      const clients = await this.clientRepository.find({
        where: { active: true, tenantId: getEffectiveTenantId() },
        order: { registrationDate: 'DESC' },
        take: 20,
      });
      return clients.map(c => ({
        id: c.id,
        name: c.name,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        hasDigitalAccount: c.userId != null,
      }));
    }

    const clients = await this.clientRepository.find({
      where: [
        { name: ILike(`%${q}%`), active: true, tenantId: getEffectiveTenantId() },
        { lastName: ILike(`%${q}%`), active: true, tenantId: getEffectiveTenantId() },
        { email: ILike(`%${q}%`), active: true, tenantId: getEffectiveTenantId() },
        { phone: ILike(`%${q}%`), active: true, tenantId: getEffectiveTenantId() },
      ],
      take: 20,
    });

    return clients.map(c => ({
      id: c.id,
      name: c.name,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      hasDigitalAccount: c.userId != null,
    }));
  }

  async createPosClient(userId: number, dto: CreatePosClientDto) {
    await this.getValidCashierBranch(userId);

    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check for existing client with same email
    const existingClient = await this.clientRepository.findOne({
      where: { email: normalizedEmail }
    });
    if (existingClient) {
      throw new ConflictException('Ya existe un cliente registrado con este correo.');
    }

    // Check for existing user with same email
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail }
    });
    if (existingUser) {
      throw new ConflictException('Este correo ya pertenece a un usuario digital. Por favor, asocie la cuenta o use otro correo.');
    }

    const client = this.clientRepository.create({
      name: dto.name.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      phone: dto.phone?.trim() || null,
      active: true,
      userId: null,
    } as any);

    const saved = await this.clientRepository.save(client) as unknown as Client;

    return {
      id: saved.id,
      name: saved.name,
      lastName: saved.lastName,
      email: saved.email,
      phone: saved.phone,
      hasDigitalAccount: false,
    };
  }

  // ───────────────────────── Pago por QR en el POS ─────────────────────────

  onModuleInit() {
    // Libera el stock de los QR que nadie pagó (por si el cajero cierra la pantalla)
    if (process.env.NODE_ENV !== 'test') {
      const t = setInterval(() => { void this.expirePendingQrSales(); }, 60_000);
      t.unref?.();
    }
  }

  /**
   * Cierra un pago QR de POS: APROBADO (descuenta el stock reservado) o FAIL (libera la reserva).
   * Idempotente: si la venta ya no está PENDIENTE no hace nada.
   */
  async settleQrPayment(paymentId: number, result: 'SUCCESS' | 'FAIL') {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const payment = await qr.manager.findOne(Payment, { where: { id: paymentId } });
      if (!payment || !payment.saleId) throw new NotFoundException('Pago no encontrado');
      const sale = await qr.manager.findOne(Sale, { where: { id: payment.saleId }, relations: { items: true } });
      if (!sale || sale.channel !== SaleChannel.POS) throw new NotFoundException('Venta POS no encontrada');
      if (sale.status !== SaleStatus.PENDIENTE) {
        await qr.rollbackTransaction();
        return { status: payment.status, sale: sale.status, alreadyProcessed: true };
      }

      for (const item of sale.items) {
        const inv = await qr.manager.findOne(Inventory, { where: { branchId: sale.branchId, variantId: item.variantId }, lock: { mode: 'pessimistic_write' } });
        if (!inv) continue;
        inv.reserved = Math.max(0, inv.reserved - item.quantity);
        if (result === 'SUCCESS') inv.stock -= item.quantity;
        await qr.manager.save(Inventory, inv);
        await qr.manager.save(InventoryMovement, qr.manager.create(InventoryMovement, {
          inventoryId: inv.id,
          type: result === 'SUCCESS' ? MovementType.VENTA : MovementType.LIBERACION_RESERVA,
          quantity: item.quantity,
          userId: sale.userId,
          observation: result === 'SUCCESS' ? `Venta POS #${sale.id} (pagada por QR)` : `Liberación: QR no pagado (venta #${sale.id})`,
        }));
      }

      payment.status = result === 'SUCCESS' ? PaymentStatus.APROBADO : PaymentStatus.RECHAZADO;
      sale.status = result === 'SUCCESS' ? SaleStatus.COMPLETADA : SaleStatus.CANCELADA;
      await qr.manager.save(Payment, payment);
      await qr.manager.save(Sale, sale);
      await qr.commitTransaction();
      return { status: payment.status, sale: sale.status, alreadyProcessed: false };
    } catch (e) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Estado del cobro QR para el cajero (con expiración perezosa). */
  async getQrSaleStatus(userId: number, saleId: number) {
    const sale = await this.dataSource.manager.findOne(Sale, { where: { id: saleId, userId, channel: SaleChannel.POS } });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    let payment = await this.dataSource.manager.findOne(Payment, { where: { saleId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (sale.status === SaleStatus.PENDIENTE && payment.expiresAt && new Date() > payment.expiresAt) {
      await this.settleQrPayment(payment.id, 'FAIL');
      payment = (await this.dataSource.manager.findOne(Payment, { where: { id: payment.id } }))!;
    }
    const fresh = await this.dataSource.manager.findOne(Sale, { where: { id: saleId } });
    return { saleId, status: payment.status, saleStatus: fresh?.status, expired: payment.status === PaymentStatus.RECHAZADO && !!payment.expiresAt && new Date() > payment.expiresAt, amount: payment.amount };
  }

  /** El cajero cancela un cobro QR pendiente (libera el stock reservado). */
  async cancelQrSale(userId: number, saleId: number) {
    const sale = await this.dataSource.manager.findOne(Sale, { where: { id: saleId, userId, channel: SaleChannel.POS } });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    const payment = await this.dataSource.manager.findOne(Payment, { where: { saleId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (sale.status !== SaleStatus.PENDIENTE) throw new ConflictException('Esta venta ya no está pendiente de pago');
    return this.settleQrPayment(payment.id, 'FAIL');
  }

  async expirePendingQrSales() {
    try {
      const rows = await this.dataSource.query(
        `SELECT p.id FROM payments p JOIN sales s ON s.id = p."saleId"
          WHERE s.channel = 'POS' AND s.status = 'PENDIENTE' AND p.provider = 'DEMO_QR' AND p."expiresAt" < NOW()`);
      for (const r of rows) await this.settleQrPayment(r.id, 'FAIL').catch(() => {});
      if (rows.length) this.logger.log(`QR de POS vencidos liberados: ${rows.length}`);
    } catch (e) {
      this.logger.warn(`No se pudo revisar QR vencidos: ${(e as any).message}`);
    }
  }
}
