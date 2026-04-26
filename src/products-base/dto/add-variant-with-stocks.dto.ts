import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsUUID,
  IsEnum,
  Min
} from 'class-validator';

export class StockLocationDto {
  @ApiProperty({
    example: 'branch-uuid',
    description: 'ID de la sucursal (opcional si es tránsito)',
    required: false
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    example: 'branch',
    description: 'Tipo de ubicación',
    enum: ['branch', 'transit', 'warehouse']
  })
  @IsEnum(['branch', 'transit', 'warehouse'])
  locationType: 'branch' | 'transit' | 'warehouse';

  @ApiProperty({
    example: 10,
    description: 'Cantidad de stock en esta ubicación'
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    example: 5,
    description: 'Stock mínimo para alertas',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class AddVariantWithStocksDto {
  @ApiProperty({
    example: 'Taladro Percutor 20V',
    description:
      'Nombre de la variante (si no se especifica, usa el del ProductBase)',
    required: false
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 45000,
    description: 'Precio de la variante'
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 30000,
    description: 'Precio de compra de la variante',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({
    example: 'SKU-CUSTOM-123',
    description:
      'SKU personalizado (si no se especifica, se genera automáticamente)',
    required: false
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    example: 5,
    description: 'Stock mínimo para alertas',
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiProperty({
    description: 'Stocks en diferentes ubicaciones',
    type: [StockLocationDto]
  })
  @IsArray()
  stocks: StockLocationDto[];
}
