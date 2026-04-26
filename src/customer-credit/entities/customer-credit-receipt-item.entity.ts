import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Order } from 'src/orders/entities/order.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { CustomerCreditDocument } from './customer-credit-document.entity';
import { CustomerCreditReceipt } from './customer-credit-receipt.entity';

@Entity('customer_credit_receipt_items')
@Index('uq_credit_receipt_item_by_payment', ['paymentId'], {
  unique: true,
  where: '"paymentId" IS NOT NULL'
})
export class CustomerCreditReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  receiptId: string;

  @ManyToOne(() => CustomerCreditReceipt, (receipt) => receipt.items, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'receiptId' })
  receipt: CustomerCreditReceipt;

  @Column()
  creditDocumentId: string;

  @ManyToOne(() => CustomerCreditDocument, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'creditDocumentId' })
  creditDocument: CustomerCreditDocument;

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

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountApplied: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceAfter: number;

  @CreateDateColumn()
  createdAt: Date;
}
