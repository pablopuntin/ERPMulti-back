import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { Order } from './order.entity';

export enum OrderItemStatus {
  PENDING = 'pending',
  RESERVED = 'reserved',
  APPROVED = 'approved',
  APPROVED_PENDING_STOCK = 'approved_pending_stock',
  REJECTED = 'rejected',
  DELIVERED = 'delivered'
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => ProductVariant, { eager: true })
  variant: ProductVariant;

  @Column('int')
  quantity: number;

  @Column({
    type: 'enum',
    enum: OrderItemStatus,
    default: OrderItemStatus.PENDING
  })
  status: OrderItemStatus;

  @Column('int', { default: 0 })
  approvedQuantity: number;

  @Column('int', { default: 0 })
  reservedQuantity: number;

  @Column('int', { default: 0 })
  deliveredQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
