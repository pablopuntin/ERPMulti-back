import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';

export enum CustomerCreditPaymentMode {
  AUTO = 'auto',
  BY_DOCUMENTS = 'by_documents'
}

export class ApplyCustomerCreditDocumentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  creditDocumentId: string;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class ApplyCustomerCreditPaymentDto {
  @ApiPropertyOptional({
    description: 'Monto total a aplicar. Requerido para modo automático.',
    example: 150000
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Método de pago registrado en caja.',
    example: 'cash',
    default: 'cash'
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Notas del cobro.',
    example: 'Cobro parcial acordado con el cliente'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Usuario que registró el cobro. Si no se envía, se usa el usuario autenticado.',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  paidByUserId?: string;

  @ApiPropertyOptional({
    enum: CustomerCreditPaymentMode,
    default: CustomerCreditPaymentMode.AUTO
  })
  @IsOptional()
  @IsEnum(CustomerCreditPaymentMode)
  mode?: CustomerCreditPaymentMode;

  @ApiPropertyOptional({ type: [ApplyCustomerCreditDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyCustomerCreditDocumentDto)
  applications?: ApplyCustomerCreditDocumentDto[];
}
