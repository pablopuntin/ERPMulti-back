import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  IsUUID
} from 'class-validator';

export class BulkUpdatePricesDto {
  @ApiProperty({
    example: ['11111111-1111-1111-1111-111111111111'],
    description: 'IDs de variantes a actualizar'
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  variantIds: string[];

  @ApiProperty({
    example: 'percentage',
    enum: ['percentage', 'fixed', 'direct'],
    description: 'Tipo de ajuste a aplicar'
  })
  @IsString()
  @IsIn(['percentage', 'fixed', 'direct'])
  mode: 'percentage' | 'fixed' | 'direct';

  @ApiProperty({
    example: 'purchasePrice',
    enum: ['salePrice', 'purchasePrice'],
    description: 'Base sobre la cual se calcula el nuevo precio'
  })
  @IsString()
  @IsIn(['salePrice', 'purchasePrice'])
  base: 'salePrice' | 'purchasePrice';

  @ApiProperty({
    example: 40,
    description: 'Valor del ajuste. Puede ser positivo o negativo.'
  })
  @IsNumber()
  value: number;
}
