/**
 * ENTIDADES DE SINCRONIZACIÓN OFFLINE
 *  - SyncOperation: bitácora idempotente de cada operación generada sin conexión
 *    (clave natural = tenantId + operationId UUID generado en el dispositivo).
 *  - SyncConflict: conflictos detectados al sincronizar, pendientes de resolución
 *    por un ENCARGADO/ADMIN.
 */
import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

export enum SyncOperationType {
  POS_CASH_SALE = 'POS_CASH_SALE',
  RESERVATION = 'RESERVATION',
}

export enum SyncOperationStatus {
  PROCESSING = 'PROCESSING',
  APPLIED = 'APPLIED',
  APPLIED_WITH_CONFLICT = 'APPLIED_WITH_CONFLICT',
  REJECTED = 'REJECTED',
}

export enum SyncConflictType {
  /** Se vendió offline más de lo disponible en el servidor. */
  STOCK_SHORTFALL = 'STOCK_SHORTFALL',
  /** El precio cobrado offline difiere del precio vigente. */
  PRICE_CHANGED = 'PRICE_CHANGED',
  /** La caja con la que se vendió ya estaba cerrada al sincronizar. */
  CASH_SESSION_CLOSED = 'CASH_SESSION_CLOSED',
  /** Reserva offline sin stock suficiente al sincronizar. */
  STOCK_UNAVAILABLE = 'STOCK_UNAVAILABLE',
  /** Datos inválidos (producto inactivo, fecha pasada, etc.). */
  INVALID_DATA = 'INVALID_DATA',
}

export enum SyncConflictStatus {
  PENDIENTE = 'PENDIENTE',
  RESUELTO = 'RESUELTO',
}

@Entity('offline_sync_operations')
@Unique('uq_sync_operation_tenant_uuid', ['tenantId', 'operationId'])
export class SyncOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  operationId: string;

  @Column({ type: 'varchar', length: 40 })
  type: SyncOperationType;

  @Column({ type: 'varchar', length: 30 })
  status: SyncOperationStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  deviceId: string | null;

  @Column()
  userId: number;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'jsonb', nullable: true })
  result: any;

  @Column({ type: 'timestamptz' })
  clientCreatedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;
}

@Entity('sync_conflicts')
@Index(['tenantId', 'status'])
export class SyncConflict {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  operationId: string;

  @Column({ type: 'varchar', length: 40 })
  type: SyncConflictType;

  @Column({ type: 'varchar', length: 20, default: SyncConflictStatus.PENDIENTE })
  status: SyncConflictStatus;

  @Column({ nullable: true })
  branchId: number;

  @Column({ nullable: true })
  saleId: number;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  detail: any;

  @Column({ type: 'varchar', length: 40, nullable: true })
  resolutionAction: string | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ nullable: true })
  resolvedBy: number;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
