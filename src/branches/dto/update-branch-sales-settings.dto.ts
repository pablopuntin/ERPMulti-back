import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateBranchSalesSettingsDto {
  @ApiProperty({
    example: true,
    description:
      'Si está activo, la sucursal solo puede generar ventas por el stock disponible local'
  })
  @IsBoolean()
  restrictSalesToBranchStock: boolean;
}
