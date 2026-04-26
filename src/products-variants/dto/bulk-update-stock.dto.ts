import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Min
} from 'class-validator';

export class BulkUpdateStockDto {
  @ApiProperty({
    example: ['11111111-1111-1111-1111-111111111111'],
    description: 'IDs de variantes a actualizar'
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  variantIds: string[];

  @ApiProperty({
    example: 'increment',
    enum: ['increment', 'set'],
    description:
      'Tipo de ajuste a aplicar sobre el stock de la ubicación elegida'
  })
  @IsIn(['increment', 'set'])
  mode: 'increment' | 'set';

  @ApiProperty({
    example: 'branch',
    enum: ['branch', 'warehouse', 'transit'],
    description: 'Tipo de ubicación a actualizar'
  })
  @IsIn(['branch', 'warehouse', 'transit'])
  locationType: 'branch' | 'warehouse' | 'transit';

  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'Sucursal o ubicación física asociada al stock'
  })
  @IsUUID('4')
  branchId: string;

  @ApiProperty({
    example: 10,
    description: 'Cantidad a sumar/restar o valor final según el modo'
  })
  @IsNumber()
  value: number;

  @ApiProperty({
    example: 5,
    required: false,
    description: 'Stock mínimo opcional para la ubicación actualizada'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}
