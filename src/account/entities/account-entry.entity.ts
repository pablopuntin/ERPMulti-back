import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Branch } from 'src/branches/entities/branch.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { User } from 'src/users/entities/user.entity';

export enum AccountEntryType {
  SALE_CHARGE = 'sale_charge',
  PAYMENT = 'payment',
  PAYMENT_REVERSAL = 'payment_reversal',
  ADJUSTMENT_DEBIT = 'adjustment_debit',
  ADJUSTMENT_CREDIT = 'adjustment_credit',
  OPENING_BALANCE = 'opening_balance'
}

export enum AccountEntryDirection {
  DEBIT = 'debit',
  CREDIT = 'credit'
}

export enum AccountEntrySourceModule {
  SALES = 'sales',
  PAYMENTS = 'payments',
  ACCOUNT = 'account',
  PURCHASES = 'purchases'
}

export enum AccountEntryStatus {
  ACTIVE = 'active',
  VOIDED = 'voided'
}

@Entity('account_entries')
@Index('idx_account_entries_customer_branch', [
  'customerId',
  'branchId',
  'occurredAt'
])
@Index('idx_account_entries_branch_seq', ['branchId', 'branchScopedSequence'])
@Index('idx_account_entries_idempotency', ['idempotencyKey'], { unique: true })
export class AccountEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, { nullable: false })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: AccountEntryType })
  entryType: AccountEntryType;

  @Column({ type: 'enum', enum: AccountEntryDirection })
  entryDirection: AccountEntryDirection;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balanceAfter: number;

  @Column({ default: 'ARS' })
  currency: string;

  @Column({ type: 'enum', enum: AccountEntrySourceModule })
  sourceModule: AccountEntrySourceModule;

  @Column()
  sourceEntityType: string;

  @Column()
  sourceEntityId: string;

  @Column()
  idempotencyKey: string;

  @Column({ type: 'int' })
  branchScopedSequence: number;

  @Column({ type: 'timestamp' })
  occurredAt: Date;

  @Column()
  createdByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User;

  @Column({ nullable: true })
  cashierUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cashierUserId' })
  cashierUser?: User;

  @Column({ nullable: true })
  reasonCode?: string;

  @Column({ type: 'text', nullable: true })
  reasonText?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: AccountEntryStatus,
    default: AccountEntryStatus.ACTIVE
  })
  status: AccountEntryStatus;

  @Column({ type: 'timestamp', nullable: true })
  voidedAt?: Date;

  @Column({ nullable: true })
  voidedByUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'voidedByUserId' })
  voidedByUser?: User;

  @Column({ type: 'text', nullable: true })
  voidReason?: string;

  @Column({ nullable: true })
  reversedByEntryId?: string;

  @ManyToOne(() => AccountEntry, { nullable: true })
  @JoinColumn({ name: 'reversedByEntryId' })
  reversedByEntry?: AccountEntry;

  @CreateDateColumn()
  createdAt: Date;
}
