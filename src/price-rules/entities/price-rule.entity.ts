import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Brand } from 'src/brands/entities/brand.entity';
import { Category } from 'src/categories/entities/category.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'price_rules' })
export class PriceRule {
  @ApiProperty({
    description: 'ID único de la regla de precios',
    example: '0b54a6e1-9bb5-4c1a-8dd9-424b5eaa1234'
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Nombre de la regla de precios',
    example: 'Aumento por temporada alta'
  })
  @Column()
  name: string;

  @ApiProperty({
    description: 'Porcentaje de ajuste de precio',
    example: 12.5
  })
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @ApiProperty({
    description: 'Fecha de inicio de la regla',
    example: '2025-01-01T00:00:00.000Z'
  })
  @Column({ type: 'timestamp' })
  startDate: Date;

  @ApiProperty({
    description: 'Fecha de fin de la regla',
    example: '2025-01-31T23:59:59.000Z'
  })
  @Column({ type: 'timestamp' })
  endDate: Date;

  @ApiProperty({
    description: 'Indica si la regla está activa',
    example: true
  })
  @Column({ default: true })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Marca asociada a la regla'
  })
  @ManyToOne(() => Brand, { nullable: true })
  brand?: Brand;

  @ApiPropertyOptional({
    description: 'Categoría asociada a la regla'
  })
  @ManyToOne(() => Category, { nullable: true })
  category?: Category;

  @ApiPropertyOptional({
    description: 'Usuario que creó la regla'
  })
  @ManyToOne(() => User, { nullable: true })
  createdBy?: User;

  @ApiProperty({
    description: 'Fecha automática de creación',
    example: '2025-01-15T12:34:56.000Z'
  })
  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt: Date;
}
