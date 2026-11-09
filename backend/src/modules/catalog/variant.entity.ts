import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany, Unique,
} from 'typeorm';
import { Product } from './product.entity';
import { Size } from './size.entity';
import { Color } from './color.entity';
import { Inventory } from '../inventory/inventory.entity';
import { ReservationItem } from '../reservations/reservation-item.entity';
import { SaleItem } from '../sales/sale-item.entity';

/** Variante (SKU) de un producto; el SKU es único dentro de la empresa. */
@Entity('variants')
@Unique('uq_variants_tenant_id', ['tenantId', 'id'])
@Unique('uq_variants_tenant_sku', ['tenantId', 'sku'])
export class Variant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  sku: string;

  @Column({ default: true })
  active: boolean;

  @Column()
  productId: number;

  @Column()
  sizeId: number;

  @Column()
  colorId: number;

  // FK compuesta: el producto DEBE pertenecer al mismo tenant que la variante
  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn([
    { name: 'productId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_variants_product_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  product: Product;

  @ManyToOne(() => Size, (size) => size.variants)
  @JoinColumn([
    { name: 'sizeId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_variants_size_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  size: Size;

  @ManyToOne(() => Color, (color) => color.variants)
  @JoinColumn([
    { name: 'colorId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_variants_color_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  color: Color;

  @OneToMany(() => Inventory, (inventory) => inventory.variant)
  inventories: Inventory[];

  @OneToMany(() => ReservationItem, (item) => item.variant)
  reservationItems: ReservationItem[];

  @OneToMany(() => SaleItem, (item) => item.variant)
  saleItems: SaleItem[];
}
