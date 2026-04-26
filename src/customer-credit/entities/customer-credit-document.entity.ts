import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { Order } from 'src/orders/entities/order.entity';
import { User } from 'src/users/entities/user.entity';
import { CustomerCreditMovement } from './customer-credit-movement.entity';

export enum CustomerCreditDocumentStatus {
  OPEN = 'open',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  CANCELLED = 'cancelled'
}

@Entity('customer_credit_documents')
export class CustomerCreditDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ unique: true })
  orderId: string;

  @ManyToOne(() => Order, { nullable: false, eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  orderRemitoNumber?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  originalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({
    type: 'enum',
    enum: CustomerCreditDocumentStatus,
    default: CustomerCreditDocumentStatus.OPEN
  })
  status: CustomerCreditDocumentStatus;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  firstPaymentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPaymentAt?: Date;

  @Column({ default: false })
  pricingLocked: boolean;

  @Column({ default: false })
  pricingUpdatedBeforeFirstPayment: boolean;

  @Column({ nullable: true })
  createdByUserId?: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser?: User;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(
    () => CustomerCreditMovement,
    (movement) => movement.creditDocument,
    { cascade: true }
  )
  movements: CustomerCreditMovement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
