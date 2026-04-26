import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export enum CustomerCreditAdjustmentType {
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note'
}

export class ApplyCustomerCreditAdjustmentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Documento de cuenta corriente a ajustar'
  })
  @IsUUID()
  creditDocumentId: string;

  @ApiProperty({
    enum: CustomerCreditAdjustmentType,
    example: CustomerCreditAdjustmentType.CREDIT_NOTE,
    description: 'Tipo de ajuste documental sobre la deuda'
  })
  @IsEnum(CustomerCreditAdjustmentType)
  type: CustomerCreditAdjustmentType;

  @ApiProperty({
    example: 15000,
    description: 'Importe del ajuste sobre el documento'
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    example: 'Promoción omitida al facturar el remito',
    description: 'Motivo obligatorio del ajuste'
  })
  @IsString()
  reason: string;
}
