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

  /** LLM/LLM_LOCAL = modelo generativo; IA_LOCAL = NB+Reglas; REGLAS = reglas puras (legado). */
  // 10 caracteres alcanzan (el valor más largo es LLM_LOCAL); no ampliar: obliga a recrear la columna en bases existentes
  @Column({ type: 'varchar', length: 10 })
  engine: 'LLM' | 'LLM_LOCAL' | 'IA_LOCAL' | 'REGLAS';

  @Column({ default: 0 })
  rowCount: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
