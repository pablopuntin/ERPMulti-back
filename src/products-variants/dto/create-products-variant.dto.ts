import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  Min
} from 'class-validator';

export class CreateProductVariantDto {
  @ApiProperty({
    example: 'SKU001-LAV-250',
    description: 'SKU opcional para identificar la variante',
    required: false
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: 'Lavanda 250ml' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1200.5 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 800, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 'AZUL', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: '250ml', required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({
    description: 'Url de la imagen del producto',
    example:
      'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
    required: false
  })
  @IsOptional()
  @IsString()
  imgURL?: string;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: 'uuid-del-producto-base' })
  @IsUUID()
  productBaseId: string;
}
