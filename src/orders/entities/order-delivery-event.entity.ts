import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { Order } from './order.entity';
import { User } from 'src/users/entities/user.entity';
import { OrderDeliveryEventItem } from './order-delivery-event-item.entity';

@Entity('order_delivery_events')
export class OrderDeliveryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, (order) => order.deliveryEvents, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  deliveredByUserId?: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'deliveredByUserId' })
  deliveredByUser?: User;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => OrderDeliveryEventItem, (item) => item.deliveryEvent, {
    cascade: true,
    eager: true
  })
  items: OrderDeliveryEventItem[];

  @CreateDateColumn()
  createdAt: Date;
}
