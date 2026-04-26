import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { CustomerBranch } from './customer-branch.entity';
import { Order } from 'src/orders/entities/order.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  document?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isCreditEnabled: boolean;

  @Column({ default: true })
  creditAutoRepriceBeforeFirstPayment: boolean;

  @Column({ type: 'int', default: 0 })
  creditPaymentTermDays: number;

  @OneToMany(
    () => CustomerBranch,
    (customerBranch) => customerBranch.customer,
    {
      cascade: true
    }
  )
  branchAssignments: CustomerBranch[];

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
