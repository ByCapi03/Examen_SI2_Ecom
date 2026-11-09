import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Unique } from 'typeorm';
import { Season } from './season.entity';
import { Product } from './product.entity';

/** Colección propia de cada empresa; su temporada debe ser del mismo tenant. */
@Entity('collections')
@Unique('uq_collections_tenant_id', ['tenantId', 'id'])
export class Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  seasonId: number;

  @Column({ default: true })
  active: boolean;

  // FK compuesta: la temporada DEBE pertenecer al mismo tenant que la colección
  @ManyToOne(() => Season, (season) => season.collections)
  @JoinColumn([
    { name: 'seasonId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_collections_season_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  season: Season;

  @OneToMany(() => Product, (product) => product.collection)
  products: Product[];
}
