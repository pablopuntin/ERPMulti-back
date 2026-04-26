import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { SupplierProduct } from './supplier-product.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Purchase } from 'src/purchase/entities/purchase.entity';

@Entity({ name: 'suppliers' })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contactName?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el usuario está activo en el sistema'
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  taxId?: string; // CUIT/RUT/NIF del proveedor

  @Column({ default: true })
  isActive: boolean;

  // ✅ Un proveedor puede tener muchos registros de productos que ha suministrado
  @OneToMany(() => SupplierProduct, (sp) => sp.supplier)
  suppliedProducts: SupplierProduct[];

  @OneToMany(() => Purchase, (purchase) => purchase.supplier)
  purchases: Purchase[];
}
