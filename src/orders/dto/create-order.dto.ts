import {
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({
    description: 'ID de la variante del producto',
    example: '5b5e3c66-34a8-4b37-a15c-52fd6e5cf27c'
  })
  @IsUUID()
  variantId: string;

  @ApiProperty({
    description: 'Cantidad del producto solicitada',
    example: 3
  })
  @IsInt()
  quantity: number;

  @ApiProperty({
    description: 'Precio unitario de la variante al momento de la compra',
    example: 1500
  })
  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID del usuario que genera la orden',
    example: '3c5a2e87-92fb-4cc1-9e16-d1d1bdc2a7b9'
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'ID de la sucursal donde se registra la venta',
    example: '3c5a2e87-92fb-4cc1-9e16-d1d1bdc2a7b1',
    required: false
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'ID del cliente interno asociado al remito',
    example: '3c5a2e87-92fb-4cc1-9e16-d1d1bdc2a7b2'
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Nombre libre del cliente cuando no exista un registro formal',
    example: 'José Pérez'
  })
  @IsOptional()
  @IsString()
  customerNameSnapshot?: string;

  @ApiPropertyOptional({
    description: 'Notas generales del remito',
    example: 'El cliente pidió consultar por dos productos sin stock local'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Listado de productos incluidos en la orden',
    type: [OrderItemDto],
    example: [
      {
        variantId: 'a864d943-14ea-4e32-88d5-8ad927e5fa52',
        quantity: 2,
        price: 1200
      },
      {
        variantId: 'b3a7943f-f503-41ce-a19e-afb498c4fd47',
        quantity: 1,
        price: 2500
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
