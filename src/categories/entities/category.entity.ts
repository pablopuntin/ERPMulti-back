//refactor
import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { Brand } from 'src/brands/entities/brand.entity';

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Nombre de la categoría',
    example: 'Sahumerios'
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @ApiProperty({
    description: 'Descripción de la categoría',
    example: 'Sahumerios de distintas marcas',
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

  // 🔄 Muchas categorías pueden tener muchas marcas
  @ManyToMany(() => Brand, (brand) => brand.categories)
  @JoinTable({
    name: 'category_brands', // Nombre de la tabla intermedia
    joinColumn: { name: 'category_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'brand_id', referencedColumnName: 'id' }
  })
  brands: Brand[];
}
