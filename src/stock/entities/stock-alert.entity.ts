import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn
} from 'typeorm';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

@Entity()
export class StockAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductVariant, { eager: true })
  variant: ProductVariant;

  @Column()
  currentStock: number;

  @Column()
  minStock: number;

  @Column()
  message: string;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
