import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { ProductsBase } from 'src/products-base/entities/products-base.entity';
import { ProductImage } from 'src/product-image/entities/product-image.entity';
import { ApiProperty } from '@nestjs/swagger';
import { SupplierProduct } from 'src/suppliers/entities/supplier-product.entity';
import { StockMovement } from 'src/stock/entities/stock.entity';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { ProductVariantBranch } from './product-variant-branch.entity';

@Entity({ name: 'productvariants' })
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  sku: string; // SKU OBLIGATORIO y único

  @Column({ type: 'varchar', length: 100 })
  name: string; // Ej: "Lavanda 250ml" o "Vainilla 500ml"

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  purchasePrice: number;

  // ❌ ELIMINAR - Stock se maneja en StockLocation
  // @Column({ type: 'int', default: 0 })
  // stock: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size?: string;

  @Column({ type: 'int', default: 5 })
  minStock: number;

  @Column({
    type: 'text',
    default:
      'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg'
  })
  imgURL: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el usuario está activo en el sistema'
  })
  @Column({ default: true })
  isActive: boolean;

  // ✅ Relación con ProductBase
  @ManyToOne(() => ProductsBase, (productBase) => productBase.variants, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'product_base_id' })
  productBase: ProductsBase;

  @OneToMany(() => SupplierProduct, (sp) => sp.variant)
  supplierProducts: SupplierProduct[];

  @OneToMany(() => ProductImage, (image) => image.variant, { cascade: true })
  images?: ProductImage[];

  @OneToMany(() => StockMovement, (movement) => movement.variant)
  stockMovements: StockMovement[];

  @OneToMany(
    () => StockLocation,
    (stockLocation) => stockLocation.productVariant
  )
  stockLocations: StockLocation[];

  @OneToMany(
    () => ProductVariantBranch,
    (branchAssignment) => branchAssignment.variant
  )
  branchAssignments: ProductVariantBranch[];
}
