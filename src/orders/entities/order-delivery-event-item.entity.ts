import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { OrderDeliveryEvent } from './order-delivery-event.entity';
import { OrderItem } from './order-item.entity';

@Entity('order_delivery_event_items')
export class OrderDeliveryEventItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  deliveryEventId: string;

  @ManyToOne(() => OrderDeliveryEvent, (deliveryEvent) => deliveryEvent.items, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'deliveryEventId' })
  deliveryEvent: OrderDeliveryEvent;

  @Column()
  orderItemId: string;

  @ManyToOne(() => OrderItem, { nullable: false, eager: true })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column({ type: 'int' })
  deliveredQuantity: number;

  @Column({ type: 'int', default: 0 })
  cumulativeDeliveredQuantity: number;

  @Column({ type: 'int', default: 0 })
  pendingQuantity: number;

  @Column({ type: 'varchar', length: 255 })
  variantName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  variantSku?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
