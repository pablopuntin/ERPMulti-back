import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockLocationType } from 'src/branches/entities/stock-location.entity';

export class TransferStockLocationDto {
  @ApiProperty({ enum: StockLocationType })
  @IsEnum(StockLocationType)
  locationType: StockLocationType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class TransferStockDto {
  @ApiProperty({ example: 'uuid-variant-id' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ type: TransferStockLocationDto })
  @ValidateNested()
  @Type(() => TransferStockLocationDto)
  from: TransferStockLocationDto;

  @ApiProperty({ type: TransferStockLocationDto })
  @ValidateNested()
  @Type(() => TransferStockLocationDto)
  to: TransferStockLocationDto;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'Redistribución interna', required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: 'uuid-user-id', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
