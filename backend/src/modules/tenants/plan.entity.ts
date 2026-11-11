import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Subscription } from './subscription.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceMonthly: number;

  /** Precio si se paga el año completo (por defecto 10 meses: 2 meses gratis). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceYearly: number;

  @Column({ type: 'int', default: 2 })
  maxBranches: number;

  /** Máximo de productos activos. null = ilimitado. */
  @Column({ type: 'int', nullable: true })
  maxProducts: number | null;

  /** Máximo de usuarios internos activos (admin, encargados y cajeros). null = ilimitado. */
  @Column({ type: 'int', nullable: true })
  maxUsers: number | null;

  @Column({ default: false })
  aiGenerativeReports: boolean;

  @Column({ default: true })
  offlineOperations: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Subscription, (sub) => sub.plan)
  subscriptions: Subscription[];
}

