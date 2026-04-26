import { IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID de la orden para la cual se registra el pago',
    example: 'dfb94b01-44ea-42dc-9b3e-a1a5b65a4444'
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Monto del pago',
    example: 1500.5
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Método de pago (efectivo, tarjeta, transferencia, etc.)',
    example: 'cash'
  })
  @IsString()
  method: string;

  @ApiProperty({
    description: 'ID del usuario que registró el pago',
    example: 'c81b45e2-59c4-4cc5-9f01-2d452123abcd'
  })
  @IsUUID()
  paidByUserId: string;

  @ApiPropertyOptional({
    description: 'Notas o comentarios del pago',
    example: 'Pago desde caja 2'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
