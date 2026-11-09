import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Código OTP enviado al correo del futuro administrador antes de cobrar el plan. */
@Entity('registration_verifications')
export class RegistrationVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  email: string;

  @Column()
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
