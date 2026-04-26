import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeliverOrderItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  deliveredQuantity: number;
}

export class DeliverOrderDto {
  @ApiProperty({ type: [DeliverOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverOrderItemDto)
  items: DeliverOrderItemDto[];

  @ApiPropertyOptional({ example: 'Entrega parcial desde caja' })
  @IsOptional()
  @IsString()
  notes?: string;
}
