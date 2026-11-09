/**
 * CASH REGISTER ENTITY
 * La "caja" física o lógica de una sucursal (Caja 1, Caja Principal...).
 * Se crea una vez; cada turno de un cajero (CashSession) se abre sobre una caja.
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Branch } from '../branches/branch.entity';

@Entity('cash_registers')
@Index('IDX_CASH_REGISTER_NAME_PER_BRANCH', ['tenantId', 'branchId', 'name'], { unique: true })
export class CashRegister {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  branchId: number;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Branch)
  @JoinColumn([
    { name: 'branchId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_cash_registers_branch_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;
}
