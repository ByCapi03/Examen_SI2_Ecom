/**
 * CASH SESSION ENTITY
 * Entidad de Base de Datos: Representa el "Turno" o "Arqueo de Caja". 
 * Relaciona a un usuario cajero con una sucursal, guardando con cuánto dinero 
 * abrió la caja, con cuánto cerró, y la hora de ambas acciones.
 */
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index
} from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { User } from '../auth/user.entity';
import { CashSessionStatus } from './sales.enums';
import { Sale } from './sale.entity';
import { CashRegister } from './cash-register.entity';
import { OneToMany } from 'typeorm';

@Entity('cash_sessions')
// Postgres partial index to guarantee only one OPEN session per cashier
@Index('IDX_UNIQUE_OPEN_SESSION_PER_CASHIER', ['cashierId'], { unique: true, where: "status = 'OPEN'" })
// ...y una sola sesión OPEN por caja
@Index('IDX_UNIQUE_OPEN_SESSION_PER_REGISTER', ['registerId'], { unique: true, where: "status = 'OPEN'" })
export class CashSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  branchId: number;

  @Column()
  cashierId: number;

  /** Caja sobre la que se abrió el turno (null en turnos anteriores a las cajas). */
  @Column({ type: 'int', nullable: true })
  registerId: number | null;

  @ManyToOne(() => CashRegister, { nullable: true })
  @JoinColumn({ name: 'registerId' })
  register: CashRegister | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  openingAmount: number;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  closingAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  expectedAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  difference: number;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  /** Quién abrió/cerró la caja (puede ser un ADMIN/ENCARGADO actuando por el cajero). */
  @Column({ type: 'int', nullable: true })
  openedById: number | null;

  @Column({ type: 'int', nullable: true })
  closedById: number | null;

  @Column({ type: 'enum', enum: CashSessionStatus, default: CashSessionStatus.OPEN })
  status: CashSessionStatus;

  @ManyToOne(() => Branch)
  @JoinColumn([
    { name: 'branchId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_cash_sessions_branch_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cashierId' })
  cashier: User;

  @OneToMany(() => Sale, (sale) => sale.cashSession)
  sales: Sale[];
}
