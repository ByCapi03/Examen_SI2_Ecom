import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Inventory } from './inventory.entity';
import { User } from '../auth/user.entity';
import { MovementType } from './inventory.enums';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  tenantId: number;

  @Column()
  quantity: number;

  @CreateDateColumn()
  movementDate: Date;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @Column({ type: 'text', nullable: true })
  observation: string;

  @Column()
  inventoryId: number;

  @Column({ nullable: true })
  userId: number;

  // FK compuesta: el movimiento DEBE pertenecer al mismo tenant que el inventario
  @ManyToOne(() => Inventory, (inventory) => inventory.movements)
  @JoinColumn([
    { name: 'inventoryId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_movements_inventory_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  inventory: Inventory;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;
}
