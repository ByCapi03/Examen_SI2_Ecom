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

  @Column({ type: 'int', default: 2 })
  maxBranches: number;

  @Column({ default: false })
  aiGenerativeReports: boolean;

  @Column({ default: true })
  offlineOperations: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Subscription, (sub) => sub.plan)
  subscriptions: Subscription[];
}

