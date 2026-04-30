import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Sale } from './sale.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column({ nullable: true })
  orderItemId?: string;

  @Column({ nullable: true })
  productVariantId?: string;

  @ManyToOne(() => ProductVariant, { nullable: true, eager: true })
  @JoinColumn({ name: 'productVariantId' })
  productVariant?: ProductVariant;

  @Column({ type: 'text' })
  productNameSnapshot: string;

  @Column({ nullable: true })
  skuSnapshot?: string;

  @Column({ type: 'text', nullable: true })
  variantNameSnapshot?: string;

  @Column('int', { default: 0 })
  quantityOrdered: number;

  @Column('int', { default: 0 })
  quantitySold: number;

  @Column('int', { default: 0 })
  quantityDeliveredAtSale: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  surchargeAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  lineTotal: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
