import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Branch } from 'src/branches/entities/branch.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Sale } from 'src/sales/entities/sale.entity';
import { User } from 'src/users/entities/user.entity';
import { RemitoItem } from './remito-item.entity';

export enum RemitoStatus {
  ISSUED = 'issued',
  PARTIALLY_DELIVERED = 'partially_delivered',
  DELIVERED = 'delivered',
  VOIDED = 'voided'
}

export enum RemitoSourceType {
  CUMULATIVE = 'cumulative',
  DELIVERY_EVENT = 'delivery_event'
}

@Entity('remitos')
export class Remito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  remitoNumber: string;

  @Column({
    type: 'enum',
    enum: RemitoSourceType,
    default: RemitoSourceType.CUMULATIVE
  })
  sourceType: RemitoSourceType;

  @Column({ nullable: true })
  branchId?: string;

  @ManyToOne(() => Branch, { nullable: true, eager: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @Column({ nullable: true })
  customerId?: string;

  @ManyToOne(() => Customer, { nullable: true, eager: true })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ nullable: true })
  orderId?: string;

  @ManyToOne(() => Order, { nullable: true, eager: true })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ nullable: true })
  saleId?: string;

  @ManyToOne(() => Sale, (sale) => sale.remitos, { nullable: true, eager: true })
  @JoinColumn({ name: 'saleId' })
  sale?: Sale;

  @Column({ nullable: true, unique: true })
  orderDeliveryEventId?: string;

  @Column({ nullable: true })
  issuedByUserId?: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'issuedByUserId' })
  issuedByUser?: User;

  @Column({ nullable: true })
  customerNameSnapshot?: string;

  @Column({ nullable: true })
  sellerNameSnapshot?: string;

  @Column({ nullable: true })
  branchNameSnapshot?: string;

  @Column({ nullable: true })
  contactSnapshot?: string;

  @Column({ nullable: true })
  paymentConditionSnapshot?: string;

  @Column({
    type: 'enum',
    enum: RemitoStatus,
    default: RemitoStatus.ISSUED
  })
  status: RemitoStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalOrderedAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalApprovedAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalDeliveredAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPaidAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingPaymentAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingDeliveryAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  issuedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  voidedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => RemitoItem, (item) => item.remito, {
    cascade: true,
    eager: true
  })
  items: RemitoItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
