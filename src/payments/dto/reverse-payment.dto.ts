import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReversePaymentDto {
  @ApiPropertyOptional({
    description: 'Motivo de la reversión del pago',
    example: 'Cobro duplicado detectado en caja'
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
