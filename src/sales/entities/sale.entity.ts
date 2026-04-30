import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Order } from 'src/orders/entities/order.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { User } from 'src/users/entities/user.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { SaleItem } from './sale-item.entity';
import { Remito } from 'src/remitos/entities/remito.entity';

export enum SaleStatus {
  OPEN = 'open',
  PENDING_DELIVERY = 'pending_delivery',
  PARTIALLY_DELIVERED = 'partially_delivered',
  DELIVERED = 'delivered',
  PARTIALLY_PAID = 'partially_paid',
  PARTIALLY_PAID_AND_PENDING_DELIVERY = 'partially_paid_and_pending_delivery',
  PAID_AND_PENDING_DELIVERY = 'paid_and_pending_delivery',
  PAID = 'paid',
  CANCELLED = 'cancelled'
}

export enum SalePaymentPlanType {
  CASH = 'cash',
  MIXED = 'mixed',
  CURRENT_ACCOUNT = 'current_account'
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  saleNumber: string;

  @Column({ nullable: true, unique: true })
  orderId?: string;

  @OneToOne(() => Order, (order) => order.sale, { nullable: true, eager: true })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ nullable: true })
  branchId?: string;

  @ManyToOne(() => Branch, { nullable: true, eager: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @Column({ nullable: true })
  customerId?: string;

  @ManyToOne(() => Customer, (customer) => customer.sales, {
    nullable: true,
    eager: true
  })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ nullable: true })
  customerNameSnapshot?: string;

  @Column({ nullable: true })
  customerDocumentSnapshot?: string;

  @Column({ nullable: true })
  sellerUserId?: string;

  @ManyToOne(() => User, (user) => user.salesAsSeller, {
    nullable: true,
    eager: true
  })
  @JoinColumn({ name: 'sellerUserId' })
  sellerUser?: User;

  @Column({ nullable: true })
  sellerNameSnapshot?: string;

  @Column({ nullable: true })
  createdByUserId?: string;

  @ManyToOne(() => User, (user) => user.salesAsCreator, {
    nullable: true,
    eager: true
  })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser?: User;

  @Column({ nullable: true })
  cashierUserId?: string;

  @ManyToOne(() => User, (user) => user.salesAsCashier, {
    nullable: true,
    eager: true
  })
  @JoinColumn({ name: 'cashierUserId' })
  cashierUser?: User;

  @Column({ nullable: true })
  cashierNameSnapshot?: string;

  @Column({ nullable: true })
  orderRemitoNumberSnapshot?: string;

  @Column({ default: 'standard' })
  saleType: string;

  @Column({ default: 'manual' })
  pricingMode: string;

  @Column({ default: 'ARS' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  surchargeTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaidAtSale: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  financedAmount: number;

  @Column({
    type: 'enum',
    enum: SalePaymentPlanType,
    default: SalePaymentPlanType.CASH
  })
  paymentPlanType: SalePaymentPlanType;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.OPEN
  })
  saleStatus: SaleStatus;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @OneToMany(() => SaleItem, (item) => item.sale, {
    cascade: true,
    eager: true
  })
  items: SaleItem[];

  @OneToMany(() => Remito, (remito) => remito.sale)
  remitos: Remito[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
