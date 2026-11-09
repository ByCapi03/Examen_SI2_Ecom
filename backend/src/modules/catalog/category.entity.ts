import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Unique } from 'typeorm';
import { Product } from './product.entity';

/** Categoría propia de cada empresa (el nombre es único dentro del tenant). */
@Entity('categories')
@Unique('uq_categories_tenant_id', ['tenantId', 'id'])
@Unique('uq_categories_tenant_name', ['tenantId', 'name'])
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
