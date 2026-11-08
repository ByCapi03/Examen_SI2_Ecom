import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { City } from './city.entity';
import { User } from '../auth/user.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.branches)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  cityId: number;

  @ManyToOne(() => City, (city) => city.branches)
  @JoinColumn({ name: 'cityId' })
  city: City;

  @OneToMany(() => User, (user) => user.branch)
  users: User[];
}
