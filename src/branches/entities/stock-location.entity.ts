import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Branch } from './branch.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

export enum StockLocationType {
  BRANCH = 'branch', // Stock físico en sucursal
  TRANSIT = 'transit', // Mercadería en tránsito
  PREORDER = 'preorder', // Productos con fecha de llegada futura
  WAREHOUSE = 'warehouse' // Stock en depósito central
}

@Entity('stock_locations')
export class StockLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  sku?: string; // SKU opcional para identificar el producto en esta ubicación

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  reservedQuantity: number; // Stock reservado (en carritos, pedidos pendientes)

  @Column({ type: 'int', default: 0 })
  availableQuantity: number; // quantity - reservedQuantity

  @Column({ type: 'int', nullable: true })
  minStock?: number; // Stock mínimo para alertas

  @Column({ type: 'int', nullable: true })
  maxStock?: number; // Stock máximo para gestión

  @Column({
    type: 'enum',
    enum: StockLocationType,
    default: StockLocationType.BRANCH
  })
  locationType: StockLocationType;

  @Column({ nullable: true })
  arrivesAt?: Date; // Para tránsito y preorder

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice?: number; // Precio de costo en esta ubicación

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice?: number; // Precio de venta en esta ubicación

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === Relaciones ===
  @ManyToOne(() => Branch, (branch) => branch.stockLocations, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch;

  @ManyToOne(() => ProductVariant, (variant) => variant.stockLocations, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant: ProductVariant;
}
