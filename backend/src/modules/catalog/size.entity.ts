import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Unique } from 'typeorm';
import { Variant } from './variant.entity';

/** Catálogo propio de cada empresa (el nombre es único dentro del tenant). */
@Entity('sizes')
@Unique('uq_sizes_tenant_id', ['tenantId', 'id'])
@Unique('uq_sizes_tenant_name', ['tenantId', 'name'])
export class Size {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Variant, (variant) => variant.size)
  variants: Variant[];
}
