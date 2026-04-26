import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique
} from 'typeorm';
import { Customer } from './customer.entity';
import { Branch } from 'src/branches/entities/branch.entity';

@Entity('customer_branches')
@Unique(['customerId', 'branchId'])
export class CustomerBranch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column()
  branchId: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Customer, (customer) => customer.branchAssignments, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Branch, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
