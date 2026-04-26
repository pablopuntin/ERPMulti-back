import {
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseItemDto {
  @ApiProperty({ example: 'uuid-del-variant' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  cost: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 'uuid-del-proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiProperty({ example: 'uuid-del-usuario-que-compra' })
  @IsUUID()
  userId: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @ApiPropertyOptional({ example: 'FAC-2024-00012' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: 'Compra mensual proveedor X' })
  @IsOptional()
  @IsString()
  notes?: string;
}
