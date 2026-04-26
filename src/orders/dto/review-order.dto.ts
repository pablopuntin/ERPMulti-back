import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ReviewedOrderItemStatusDto {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  APPROVED_PENDING_STOCK = 'approved_pending_stock'
}

export class ReviewOrderItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  itemId: string;

  @ApiProperty({ enum: ReviewedOrderItemStatusDto })
  @IsEnum(ReviewedOrderItemStatusDto)
  decision: ReviewedOrderItemStatusDto;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  approvedQuantity: number;

  @ApiPropertyOptional({
    example: 'Se entrega una unidad y el resto queda pendiente'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewOrderDto {
  @ApiProperty({ type: [ReviewOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewOrderItemDto)
  items: ReviewOrderItemDto[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  rejectEntireOrder?: boolean;

  @ApiPropertyOptional({ example: 'Faltan productos / error de confección' })
  @IsOptional()
  @IsString()
  notes?: string;
}
