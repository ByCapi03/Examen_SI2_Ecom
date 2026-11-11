import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne } from 'typeorm';
import { User } from '../auth/user.entity';
import { Branch } from '../branches/branch.entity';
import { Subscription } from './subscription.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  taxId: string;

  @Column({ default: true })
  active: boolean;

  /** Personalización de la web pública de la empresa (/t/<slug>). */
  @Column({ type: 'jsonb', nullable: true })
  storeConfig: Record<string, any> | null;

  @OneToOne(() => Subscription, (sub) => sub.tenant)
  subscription: Subscription;

  @OneToMany(() => Branch, (branch) => branch.tenant)
  branches: Branch[];

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

