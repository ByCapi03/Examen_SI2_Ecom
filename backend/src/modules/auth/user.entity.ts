import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { UserRole } from './user-role.entity';
import { Branch } from '../branches/branch.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity('users')
@Unique('uq_users_tenant_id', ['tenantId', 'id'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @ManyToOne(() => Tenant, (tenant) => tenant.users)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  mustChangePassword: boolean;

  @Column({ type: 'timestamp', nullable: true })
  temporaryPasswordExpiresAt: Date | null;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  verificationCodeHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verificationCodeExpiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  verificationAttempts: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  branchId: number;

  @ManyToOne(() => Branch, (branch) => branch.users)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];
}
