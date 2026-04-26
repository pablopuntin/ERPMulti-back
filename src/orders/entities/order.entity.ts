import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { OrderDeliveryEvent } from './order-delivery-event.entity';
import { User } from 'src/users/entities/user.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from 'src/customers/entities/customer.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  DRAFT = 'draft',
  SENT_TO_CASH = 'sent_to_cash',
  PARTIALLY_APPROVED = 'partially_approved',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum OrderPaymentStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid'
}

export enum OrderFulfillmentStatus {
  PENDING = 'pending',
  PARTIALLY_DELIVERED = 'partially_delivered',
  DELIVERED = 'delivered',
  PENDING_STOCK = 'pending_stock'
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  remitoNumber: string;

  @Column({ nullable: true })
  branchId?: string;

  @Column({ nullable: true })
  customerId?: string;

  @ManyToOne(() => User, (user) => user.order, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.UNPAID
  })
  paymentStatus: OrderPaymentStatus;

  @Column({
    type: 'enum',
    enum: OrderFulfillmentStatus,
    default: OrderFulfillmentStatus.PENDING
  })
  fulfillmentStatus: OrderFulfillmentStatus;

  @Column({ nullable: true })
  customerNameSnapshot?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  approvedTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveredTotal: number;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true
  })
  items: OrderItem[];

  @OneToMany(() => OrderDeliveryEvent, (deliveryEvent) => deliveryEvent.order, {
    cascade: true,
    eager: true
  })
  deliveryEvents: OrderDeliveryEvent[];

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @ManyToOne(() => Customer, (customer) => customer.orders, {
    nullable: true,
    eager: true
  })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  finalizedInCashAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
