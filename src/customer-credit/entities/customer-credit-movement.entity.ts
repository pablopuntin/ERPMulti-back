import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn
} from 'typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { User } from 'src/users/entities/user.entity';
import { CustomerCreditDocument } from './customer-credit-document.entity';

export enum CustomerCreditMovementType {
  DOCUMENT_CHARGE = 'document_charge',
  PAYMENT = 'payment',
  PAYMENT_REVERSAL = 'payment_reversal',
  SYSTEM_RECONCILIATION = 'system_reconciliation',
  REPRICE = 'reprice',
  SURCHARGE = 'surcharge',
  DISCOUNT = 'discount',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  CANCELLATION = 'cancellation'
}

export enum CustomerCreditMovementSign {
  DEBIT = 'debit',
  CREDIT = 'credit'
}

@Entity('customer_credit_movements')
export class CustomerCreditMovement {
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

  @Column({ nullable: true })
  creditDocumentId?: string;

  @ManyToOne(
    () => CustomerCreditDocument,
    (creditDocument) => creditDocument.movements,
    { nullable: true, onDelete: 'SET NULL' }
  )
  @JoinColumn({ name: 'creditDocumentId' })
  creditDocument?: CustomerCreditDocument;

  @Column({ nullable: true })
  orderId?: string;

  @ManyToOne(() => Order, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ nullable: true })
  paymentId?: string;

  @ManyToOne(() => Payment, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  @Column({ type: 'enum', enum: CustomerCreditMovementType })
  type: CustomerCreditMovementType;

  @Column({ type: 'enum', enum: CustomerCreditMovementSign })
  sign: CustomerCreditMovementSign;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceAfter: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @Column({ nullable: true })
  performedByUserId?: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'performedByUserId' })
  performedByUser?: User;

  @CreateDateColumn()
  createdAt: Date;
}
