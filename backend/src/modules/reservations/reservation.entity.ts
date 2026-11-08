import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany, OneToOne, CreateDateColumn, Unique,
} from 'typeorm';
import { Client } from '../clients/client.entity';
import { Branch } from '../branches/branch.entity';
import { ReservationItem } from './reservation-item.entity';
import { Sale } from '../sales/sale.entity';
import { ReservationStatus } from './reservation.enums';

@Entity('reservations')
@Unique('uq_reservations_tenant_id', ['tenantId', 'id'])
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  /** UUID generado en el dispositivo si la reserva se registró sin conexión. */
  @Column({ type: 'uuid', nullable: true, unique: true })
  offlineOperationId: string | null;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.PENDIENTE })
  status: ReservationStatus;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  approximateTime: string;

  @CreateDateColumn()
  registrationDate: Date;

  @Column()
  clientId: number;

  @Column()
  branchId: number;

  @ManyToOne(() => Client, (client) => client.reservations)
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @ManyToOne(() => Branch)
  @JoinColumn([
    { name: 'branchId', referencedColumnName: 'id', foreignKeyConstraintName: 'fk_reservations_branch_tenant' },
    { name: 'tenantId', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;

  @OneToMany(() => ReservationItem, (item) => item.reservation)
  items: ReservationItem[];

  @OneToOne(() => Sale, (sale) => sale.reservation)
  sale: Sale;
}
