import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany, Unique, UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { Variant } from '../catalog/variant.entity';
import { InventoryMovement } from './inventory-movement.entity';

@Entity('inventory')
@Unique(['branchId', 'variantId'])
@Unique('uq_inventory_tenant_id', ['tenantId', 'id'])
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 0 })
  reserved: number;

  @Column({ default: 0 })
  stockMin: number;

  @Column({ nullable: true })
  stockMax: number;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  branchId: number;

  @Column()
  variantId: number;

  @ManyToOne(() => Branch)
  @JoinColumn([
    { name: 'branchId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_inventory_branch_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;

  @ManyToOne(() => Variant, (variant) => variant.inventories)
  @JoinColumn({ name: 'variantId' })
  variant: Variant;

  @OneToMany(() => InventoryMovement, (movement) => movement.inventory)
  movements: InventoryMovement[];
}
