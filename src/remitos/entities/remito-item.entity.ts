import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { Remito } from './remito.entity';

@Entity('remito_items')
export class RemitoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  remitoId: string;

  @ManyToOne(() => Remito, (remito) => remito.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'remitoId' })
  remito: Remito;

  @Column({ nullable: true })
  orderItemId?: string;

  @Column({ nullable: true })
  saleItemId?: string;

  @Column({ nullable: true })
  productVariantId?: string;

  @ManyToOne(() => ProductVariant, { nullable: true, eager: true })
  @JoinColumn({ name: 'productVariantId' })
  productVariant?: ProductVariant;

  @Column({ type: 'text' })
  productNameSnapshot: string;

  @Column({ nullable: true })
  skuSnapshot?: string;

  @Column('int', { default: 0 })
  quantityOrdered: number;

  @Column('int', { default: 0 })
  quantityApproved: number;

  @Column('int', { default: 0 })
  quantityDeliveredInDocument: number;

  @Column('int', { default: 0 })
  cumulativeDeliveredQuantity: number;

  @Column('int', { default: 0 })
  pendingQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
