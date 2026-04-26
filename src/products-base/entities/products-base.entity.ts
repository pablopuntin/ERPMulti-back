import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { Brand } from 'src/brands/entities/brand.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { Category } from 'src/categories/entities/category.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'product_base' })
export class ProductsBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el usuario está activo en el sistema'
  })
  @Column({ default: true })
  isActive: boolean;

  // ✅ Muchos productos base pertenecen a una categoría
  @ManyToOne(() => Category, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  // ✅ Muchos productos base pertenecen a una marca
  @ManyToOne(() => Brand, (brand) => brand.productsBase, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  // ✅ Un producto base tiene muchas variantes
  @OneToMany(() => ProductVariant, (variant) => variant.productBase)
  variants: ProductVariant[];
}
