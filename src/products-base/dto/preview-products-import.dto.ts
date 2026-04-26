import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewProductsImportRowDto {
  @ApiProperty({ example: 'Iluminación' })
  @IsString()
  categoryName: string;

  @ApiProperty({ example: 'Philips' })
  @IsString()
  brandName: string;

  @ApiProperty({ example: 'Lámpara LED E27' })
  @IsString()
  productBaseName: string;

  @ApiProperty({ example: 'Blanco cálido 9W', required: false })
  @IsOptional()
  @IsString()
  variantName?: string;

  @ApiProperty({ example: 'LAMP-E27-9W-WW', required: false })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: 'Lámpara led de bajo consumo', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1200, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({ example: 1850 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiProperty({ example: 'Sucursal Central', required: false })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiProperty({
    example: 'branch',
    required: false,
    enum: ['branch', 'warehouse', 'transit']
  })
  @IsOptional()
  @IsString()
  @IsIn(['branch', 'warehouse', 'transit'])
  locationType?: 'branch' | 'warehouse' | 'transit';

  @ApiProperty({ example: 'Depósito Central', required: false })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiProperty({ example: 'Electrónica', required: false })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiProperty({ example: 'Lámparas', required: false })
  @IsOptional()
  @IsString()
  subgroupName?: string;
}

export class PreviewProductsImportDto {
  @ApiProperty({ type: [PreviewProductsImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreviewProductsImportRowDto)
  rows: PreviewProductsImportRowDto[];
}
