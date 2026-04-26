import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToMany
} from 'typeorm';
import { Category } from 'src/categories/entities/category.entity';
import { ProductsBase } from 'src/products-base/entities/products-base.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'brands' })
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({
    description: 'Descripción de la marca',
    example: 'xxxx Marca lider en xxxx',
    required: false
  })
  @Column({ type: 'text', nullable: true })
  description?: string;

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

  // 🔄 Muchas marcas pueden pertenecer a muchas categorías
  @ManyToMany(() => Category, (category) => category.brands)
  categories: Category[];

  // ✅ Una marca tiene muchos productos base
  @OneToMany(() => ProductsBase, (productBase) => productBase.brand)
  productsBase: ProductsBase[];
}
