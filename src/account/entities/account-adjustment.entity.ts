import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Branch } from 'src/branches/entities/branch.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { User } from 'src/users/entities/user.entity';
import { AccountEntry, AccountEntryDirection } from './account-entry.entity';

export enum AccountAdjustmentType {
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
  WRITE_OFF = 'write_off',
  OPENING_BALANCE = 'opening_balance',
  INTEREST = 'interest',
  CORRECTION = 'correction'
}

@Entity('account_adjustments')
export class AccountAdjustment {
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

  @Column({ type: 'enum', enum: AccountAdjustmentType })
  adjustmentType: AccountAdjustmentType;

  @Column({ type: 'enum', enum: AccountEntryDirection })
  direction: AccountEntryDirection;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column()
  authorizedByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'authorizedByUserId' })
  authorizedByUser: User;

  @Column()
  createdByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User;

  @Column({ nullable: true })
  entryId?: string;

  @ManyToOne(() => AccountEntry, { nullable: true })
  @JoinColumn({ name: 'entryId' })
  entry?: AccountEntry;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
