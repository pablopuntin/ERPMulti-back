import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn
} from 'typeorm';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { IsOptional } from 'class-validator';

@Entity({ name: 'supplier_products' })
export class SupplierProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ✅ Precio especial de compra (al proveedor)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: number;

  // ✅ Cantidad comprada o disponible
  @Column({ type: 'int', default: 0 })
  quantity: number;

  // ✅ Características o acuerdos especiales
  @Column({ type: 'text', nullable: true })
  specialNotes?: string;

  // ✅ Fecha de la última compra o actualización
  // @CreateDateColumn({ name: 'purchase_date' })
  // purchaseDate: Date;
  //refactor
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  purchaseDate: Date;

  @Column()
  @IsOptional()
  invoiceNumber?: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.suppliedProducts, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => ProductVariant, (variant) => variant.supplierProducts, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;
}
