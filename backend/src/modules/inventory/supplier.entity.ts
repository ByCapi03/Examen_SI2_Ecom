import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

/** Proveedor propio de cada empresa (el NIT es único dentro del tenant). */
@Entity('suppliers')
@Unique('uq_suppliers_tenant_id', ['tenantId', 'id'])
@Unique('uq_suppliers_tenant_nit', ['tenantId', 'nit'])
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: number;

  @Column()
  name: string;

  @Column()
  nit: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: true })
  active: boolean;
}
