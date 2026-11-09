import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Unique } from 'typeorm';
import { Variant } from './variant.entity';

/** Catálogo propio de cada empresa (el nombre es único dentro del tenant). */
@Entity('colors')
@Unique('uq_colors_tenant_id', ['tenantId', 'id'])
@Unique('uq_colors_tenant_name', ['tenantId', 'name'])
export class Color {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  hexCode: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Variant, (variant) => variant.color)
  variants: Variant[];
}
