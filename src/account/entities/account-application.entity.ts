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
import { AccountEntry } from './account-entry.entity';

@Entity('account_applications')
@Index('idx_account_applications_customer_branch', ['customerId', 'branchId'])
export class AccountApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, { nullable: false })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  paymentEntryId: string;

  @ManyToOne(() => AccountEntry, { nullable: false })
  @JoinColumn({ name: 'paymentEntryId' })
  paymentEntry: AccountEntry;

  @Column()
  chargeEntryId: string;

  @ManyToOne(() => AccountEntry, { nullable: false })
  @JoinColumn({ name: 'chargeEntryId' })
  chargeEntry: AccountEntry;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amountApplied: number;

  @Column()
  appliedByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'appliedByUserId' })
  appliedByUser: User;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  appliedAt: Date;
}
