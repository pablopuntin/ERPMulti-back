import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';
import { ReviewedOrderItemStatusDto } from './review-order.dto';

export class FinalizeOrderPaymentDto {
  @ApiPropertyOptional({ example: 1500.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 'cash' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ example: 'Pago total en caja' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  paidByUserId?: string;
}

export class FinalizeOrderItemDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional({
    enum: ReviewedOrderItemStatusDto,
    example: ReviewedOrderItemStatusDto.APPROVED
  })
  @IsOptional()
  @IsString()
  decision?: ReviewedOrderItemStatusDto;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(0)
  approvedQuantity: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(0)
  deliveredQuantity: number;

  @ApiPropertyOptional({ example: 'Entrega parcial' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FinalizeOrderDto {
  @ApiPropertyOptional({ type: [FinalizeOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinalizeOrderItemDto)
  items: FinalizeOrderItemDto[];

  @ApiPropertyOptional({ type: FinalizeOrderPaymentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FinalizeOrderPaymentDto)
  payment?: FinalizeOrderPaymentDto;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  forceReprint?: boolean;

  @ApiPropertyOptional({ example: 'Cierre de caja y emisión de remito' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  operationId?: string;
}
