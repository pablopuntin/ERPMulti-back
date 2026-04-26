import { IsUUID, IsNumber, IsOptional, IsString, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierProductDto {
  @ApiProperty({
    description: 'ID del proveedor',
    example: '9f1c2a53-6c7d-4a80-9bf1-b7ec1e1c2f12'
  })
  @IsUUID()
  supplierId: string;

  @ApiProperty({
    description: 'ID de la variante del producto',
    example: 'd23e8fa1-e39f-4e9b-a12d-8f302fa9c7d3'
  })
  @IsUUID()
  variantId: string;

  @ApiProperty({
    description: 'Precio de compra (permite hasta 2 decimales)',
    example: 123.45
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  purchasePrice: number;

  @ApiProperty({
    description: 'Cantidad adquirida del producto',
    example: 50
  })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({
    description: 'Notas especiales del proveedor',
    example: 'Entregar solo por la mañana'
  })
  @IsOptional()
  @IsString()
  specialNotes?: string;

  @ApiPropertyOptional({
    description: 'Número de factura del proveedor',
    example: 'FAC-2024-00125'
  })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;
}
