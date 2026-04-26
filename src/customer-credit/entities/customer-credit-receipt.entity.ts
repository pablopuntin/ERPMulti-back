import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { User } from 'src/users/entities/user.entity';
import { CustomerCreditReceiptItem } from './customer-credit-receipt-item.entity';

export enum CustomerCreditReceiptMode {
  AUTO = 'auto',
  BY_DOCUMENTS = 'by_documents'
}

@Entity('customer_credit_receipts')
export class CustomerCreditReceipt {
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

  @Column({
    type: 'enum',
    enum: CustomerCreditReceiptMode,
    default: CustomerCreditReceiptMode.AUTO
  })
  mode: CustomerCreditReceiptMode;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  requestedAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  appliedAmount: number;

  @Column({ default: 'cash' })
  method: string;

  @Column({ nullable: true })
  branchId?: string;

  @Column({ nullable: true })
  createdByUserId?: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser?: User;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => CustomerCreditReceiptItem, (item) => item.receipt, {
    cascade: true,
    eager: true
  })
  items: CustomerCreditReceiptItem[];

  @CreateDateColumn()
  createdAt: Date;
}
