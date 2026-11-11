/**
 * AUDIT LOG ENTITY (bitácora)
 * Registro inmutable de accesos y cambios por empresa: quién, cuándo, desde dónde y qué.
 * El nombre y correo del usuario se guardan copiados para que el registro sobreviva si el usuario se elimina.
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index('IDX_AUDIT_TENANT_DATE', ['tenantId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', nullable: true })
  userEmail: string | null;

  /** Roles del usuario al momento del evento, separados por coma. */
  @Column({ type: 'varchar', nullable: true })
  userRoles: string | null;

  @Column({ type: 'int', nullable: true })
  branchId: number | null;

  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  entity: string | null;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'text' })
  summary: string;

  /** JSON con los datos enviados (sin campos sensibles), recortado. */
  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column()
  method: string;

  @Column()
  path: string;

  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
