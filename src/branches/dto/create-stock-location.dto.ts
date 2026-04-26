import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString
} from 'class-validator';
import { StockLocationType } from '../entities/stock-location.entity';

export class CreateStockLocationDto {
  @ApiProperty({
    example: 'SKU001-MAIN',
    description: 'SKU opcional para identificar el producto en esta ubicación',
    required: false
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    example: 100,
    description: 'Cantidad total de stock',
    default: 0
  })
  @IsNumber()
  quantity: number = 0;

  @ApiProperty({
    example: 10,
    description: 'Stock reservado (en carritos, pedidos pendientes)',
    default: 0
  })
  @IsOptional()
  @IsNumber()
  reservedQuantity?: number = 0;

  @ApiProperty({
    example: 5,
    description: 'Stock mínimo para alertas',
    required: false
  })
  @IsOptional()
  @IsNumber()
  minStock?: number;

  @ApiProperty({
    example: 500,
    description: 'Stock máximo para gestión',
    required: false
  })
  @IsOptional()
  @IsNumber()
  maxStock?: number;

  @ApiProperty({
    enum: StockLocationType,
    example: StockLocationType.BRANCH,
    description: 'Tipo de ubicación',
    default: StockLocationType.BRANCH
  })
  @IsEnum(StockLocationType)
  locationType: StockLocationType = StockLocationType.BRANCH;

  @ApiProperty({
    example: '2024-04-01T10:00:00Z',
    description: 'Fecha de llegada (para tránsito y preorder)',
    required: false
  })
  @IsOptional()
  @IsDateString()
  arrivesAt?: string;

  @ApiProperty({
    example: 'Mercadería en tránsito desde proveedor',
    description: 'Notas adicionales',
    required: false
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: 800.5,
    description: 'Precio de costo en esta ubicación',
    required: false
  })
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiProperty({
    example: 1500.0,
    description: 'Precio de venta en esta ubicación',
    required: false
  })
  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @ApiProperty({
    example: 'branch-uuid',
    description: 'ID de la sucursal'
  })
  @IsString()
  branchId: string;

  @ApiProperty({
    example: 'product-variant-uuid',
    description: 'ID de la variante del producto'
  })
  @IsString()
  productVariantId: string;
}
