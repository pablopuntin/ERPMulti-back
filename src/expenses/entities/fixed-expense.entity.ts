import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { Branch } from 'src/branches/entities/branch.entity';

@Entity({ name: 'fixed_expenses' })
export class FixedExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal')
  amount: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: 'monthly' })
  frequency: string; // monthly, weekly, yearly...

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Supplier;

  @Column({ nullable: true })
  branchId?: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @CreateDateColumn()
  createdAt: Date;
}
