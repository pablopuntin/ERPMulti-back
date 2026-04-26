import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateProductVariantDto } from './create-products-variant.dto';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min
} from 'class-validator';

class UpdateStockLocationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ enum: ['branch', 'transit', 'warehouse'], required: false })
  @IsOptional()
  @IsEnum(['branch', 'transit', 'warehouse'])
  locationType?: 'branch' | 'transit' | 'warehouse';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class UpdateProductsVariantDto extends PartialType(
  CreateProductVariantDto
) {
  @ApiProperty({ type: [UpdateStockLocationDto], required: false })
  @IsOptional()
  @IsArray()
  stocks?: UpdateStockLocationDto[];
}
