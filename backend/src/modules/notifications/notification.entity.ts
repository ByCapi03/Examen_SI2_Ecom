/**
 * NOTIFICATION ENTITIES
 * Entidades de Base de Datos: 
 * - Notification: Guarda el historial de notificaciones (push/in-app) para los usuarios.
 * - NotificationDevice: Guarda los tokens de los dispositivos (FCM) de cada usuario para poder enviarles push notifications.
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../auth/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  tenantId: number;

  @Column()
  userId: number;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ nullable: true })
  reservationId: number;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // FK compuesta: el destinatario DEBE pertenecer al mismo tenant que la notificación
  @ManyToOne(() => User)
  @JoinColumn([
    { name: 'userId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_notifications_user_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  user: User;
}

@Entity('notification_devices')
export class NotificationDevice {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  tenantId: number;

  @Column()
  userId: number;

  @Column()
  token: string;

  @Column()
  platform: string;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
