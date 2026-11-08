import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/** Auditoría de cada reporte generativo solicitado (trazabilidad y uso por plan). */
@Entity('ai_report_logs')
@Index(['tenantId', 'createdAt'])
export class AiReportLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  userId: number;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'jsonb', nullable: true })
  spec: any;

  /** LLM = interpretado por el modelo generativo; REGLAS = intérprete local. */
  @Column({ type: 'varchar', length: 10 })
  engine: 'LLM' | 'REGLAS';

  @Column({ default: 0 })
  rowCount: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
