import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Unique } from 'typeorm';
import { Collection } from './collection.entity';

/** Temporada comercial propia de cada empresa. */
@Entity('seasons')
@Unique('uq_seasons_tenant_id', ['tenantId', 'id'])
export class Season {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Collection, (collection) => collection.season)
  collections: Collection[];
}
