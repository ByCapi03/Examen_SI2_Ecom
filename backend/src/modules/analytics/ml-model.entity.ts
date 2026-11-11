import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * Modelo de ML entrenado y persistido por empresa. Cada entrenamiento crea una
 * nueva versión (la anterior queda inactiva) con sus parámetros, métricas y la
 * procedencia de los datos (reales vs. sintéticos) usados para entrenarlo.
 */
@Entity('ml_models')
@Index(['tenantId', 'name', 'version'], { unique: true })
export class MlModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 30 })
  name: 'DEMAND_FORECAST' | 'CUSTOMER_SEGMENTS';

  @Column({ type: 'varchar', length: 20 })
  learningType: 'SUPERVISADO' | 'NO_SUPERVISADO';

  @Column()
  version: number;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  trainedBy: number;

  @Column({ default: 0 })
  trainingRows: number;

  /** { sales, realSales, syntheticSales, windowWeeks } */
  @Column({ type: 'jsonb' })
  dataSource: Record<string, any>;

  /** Parámetros aprendidos (coeficientes por producto, o centroides y normalización). */
  @Column({ type: 'jsonb' })
  params: Record<string, any>;

  /** Métricas de evaluación (MAE, mejora vs baseline, silueta, inercia...). */
  @Column({ type: 'jsonb' })
  metrics: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  trainedAt: Date;
}
