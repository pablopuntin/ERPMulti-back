import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { Purchase } from './purchase.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

@Entity({ name: 'purchase_items' })
export class PurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.items, {
    onDelete: 'CASCADE'
  })
  purchase: Purchase;

  @ManyToOne(() => ProductVariant)
  variant: ProductVariant;

  @Column('int')
  quantity: number;

  @Column('decimal')
  cost: number;

  @Column('decimal')
  subtotal: number;
}
