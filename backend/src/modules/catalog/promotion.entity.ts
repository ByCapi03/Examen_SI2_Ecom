import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, Unique } from 'typeorm';
import { Product } from './product.entity';

/** Promoción propia de cada empresa; solo puede aplicarse a productos del mismo tenant. */
@Entity('promotions')
@Unique('uq_promotions_tenant_id', ['tenantId', 'id'])
export class Promotion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'PERCENTAGE' })
  type: 'PERCENTAGE' | 'FIXED';

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ default: true })
  active: boolean;

  @ManyToMany(() => Product, (product) => product.promotions)
  @JoinTable({
    name: 'product_promotions',
    joinColumn: { name: 'promotionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'productId', referencedColumnName: 'id' }
  })
  products: Product[];
}
