import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn
} from 'typeorm';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { User } from 'src/users/entities/user.entity';
import { PriceRule } from 'src/price-rules/entities/price-rule.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'price_change_history' })
export class PriceChangeHistory {
  @ApiProperty({
    description: 'ID del historial de cambio de precios',
    example: '9b3d7e0a-56d2-4e55-bb5c-e2abf03a1234'
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Variante del producto asociada al cambio'
  })
  @ManyToOne(() => ProductVariant, { eager: true })
  variant: ProductVariant;

  @ApiProperty({
    description: 'Precio anterior del producto',
    example: 199.99
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  oldPrice: number;

  @ApiProperty({
    description: 'Nuevo precio del producto',
    example: 219.99
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  newPrice: number;

  @ApiProperty({
    description: 'Fecha en que se realizó el cambio de precio',
    example: '2025-01-15T12:34:56.000Z'
  })
  @CreateDateColumn()
  changedAt: Date;

  @ApiPropertyOptional({
    description: 'Usuario que realizó el cambio de precio'
  })
  @ManyToOne(() => User, { eager: true, nullable: true })
  changedBy?: User;

  @ApiProperty({
    description: 'Origen del cambio de precio',
    example: 'manual'
  })
  @Column({ type: 'varchar', length: 50 })
  source: 'manual' | 'rule' | 'system';

  @ApiPropertyOptional({
    description: 'Regla de precio aplicada (si corresponde)'
  })
  @ManyToOne(() => PriceRule, { nullable: true })
  priceRule?: PriceRule;
}
