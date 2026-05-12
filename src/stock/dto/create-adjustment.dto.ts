import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsNumber, Min } from 'class-validator';

export class CreateAdjustmentDto {
  @ApiProperty({
    description: 'ID de la variante de producto a ajustar',
    example: 'a3f0c8e2-28cd-44d8-92b2-19aaf88c5678'
  })
  @IsUUID()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({
    description: 'ID de la sucursal donde se hace el ajuste',
    example: 'd2a439fc-89cd-4b54-9d50-c33ab9123456'
  })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({
    description: 'Nueva cantidad de stock física (conteo real)',
    example: 50
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  newQuantity: number;

  @ApiProperty({
    description: 'Motivo del ajuste (obligatorio)',
    example: 'Rotura de stock en almacén',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
