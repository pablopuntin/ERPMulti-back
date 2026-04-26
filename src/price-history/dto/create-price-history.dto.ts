import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePriceChangeHistoryDto {
  @ApiProperty({
    description: 'ID de la variante del producto',
    example: '47fb5e4a-a70c-4f5d-b6a8-4d994a9c1234'
  })
  @IsUUID()
  variantId: string;

  @ApiProperty({
    description: 'Precio anterior',
    example: 199.99
  })
  @IsNumber()
  oldPrice: number;

  @ApiProperty({
    description: 'Nuevo precio',
    example: 219.99
  })
  @IsNumber()
  newPrice: number;

  @ApiPropertyOptional({
    description:
      'Fecha en la que ocurrió el cambio (opcional, se asigna automáticamente si no se envía)',
    example: '2025-01-15T12:34:56.000Z'
  })
  @IsOptional()
  @IsDateString()
  changedAt?: Date;

  @ApiPropertyOptional({
    description: 'ID del usuario que realizó el cambio',
    example: 'a3c8faef-29d6-4f33-945d-514231231234'
  })
  @IsOptional()
  @IsUUID()
  changedById?: string;

  @ApiProperty({
    description: 'Origen del cambio de precio',
    example: 'rule',
    enum: ['manual', 'rule', 'system']
  })
  @IsEnum(['manual', 'rule', 'system'])
  source: 'manual' | 'rule' | 'system';

  @ApiPropertyOptional({
    description: 'ID de la regla de precio aplicada (si la hay)',
    example: '0b54a6e1-9bb5-4c1a-8dd9-424b5eaa1234'
  })
  @IsOptional()
  @IsUUID()
  priceRuleId?: string;
}
