import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min
} from 'class-validator';
import { StockMovementType } from '../entities/stock.entity';

export class CreateStockMovementDto {
  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'uuid-variant-id' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 'uuid-user-id' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'uuid-supplier-id', required: false })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty({ example: 'Reposición desde proveedor', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
