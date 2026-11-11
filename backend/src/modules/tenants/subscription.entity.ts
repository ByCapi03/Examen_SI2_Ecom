import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Plan } from './plan.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tenant_id' })
  tenantId: number;

  @OneToOne(() => Tenant, (tenant) => tenant.subscription, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  /** ACTIVE | EXPIRED | SUSPENDED */
  @Column({ default: 'ACTIVE' })
  status: string;

  /** MONTHLY (1 mes) | YEARLY (1 año, con precio anual del plan). */
  @Column({ name: 'billing_cycle', default: 'MONTHLY' })
  billingCycle: string;

  @Column({ type: 'timestamp', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'end_date' })
  endDate: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

