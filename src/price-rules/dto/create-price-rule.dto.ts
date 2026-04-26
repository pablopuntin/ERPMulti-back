// import { IsString, IsBoolean, IsOptional, IsUUID, IsNumber, IsDateString } from 'class-validator';
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// export class CreatePriceRuleDto {
//   @ApiProperty({
//     description: 'Nombre de la regla de precios',
//     example: 'Aumento de temporada',
//   })
//   @IsString()
//   name: string;

//   @ApiProperty({
//     description: 'Porcentaje de ajuste (positivo o negativo)',
//     example: 10.5,
//   })
//   @IsNumber()
//   percentage: number;

//   @ApiProperty({
//     description: 'Fecha de inicio de la regla',
//     example: '2025-01-01T00:00:00.000Z',
//   })
//   @IsDateString()
//   startDate: Date;

//   @ApiProperty({
//     description: 'Fecha de fin de la regla',
//     example: '2025-01-31T23:59:59.000Z',
//   })
//   @IsDateString()
//   endDate: Date;

//   @ApiPropertyOptional({
//     description: 'Indica si la regla está activa',
//     example: true,
//   })
//   @IsOptional()
//   @IsBoolean()
//   isActive?: boolean;

//   @ApiPropertyOptional({
//     description: 'ID de la marca',
//     example: '47fb5e4a-a70c-4f5d-b6a8-4d994a9c1234',
//   })
//   @IsOptional()
//   @IsUUID()
//   brandId?: string;

//   @ApiPropertyOptional({
//     description: 'ID de la categoría',
//     example: 'c79ba71c-e878-4e10-9ed6-bef2d2021234',
//   })
//   @IsOptional()
//   @IsUUID()
//   categoryId?: string;

//   @ApiPropertyOptional({
//     description: 'ID del usuario creador',
//     example: 'a3c8faef-29d6-4f33-945d-514231231234',
//   })
//   @IsOptional()
//   @IsUUID()
//   createdById?: string;
// }

//refactor
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsDateString
} from 'class-validator';

export class CreatePriceRuleDto {
  @ApiProperty({
    description: 'Nombre de la regla de precios',
    example: 'Aumento por temporada'
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Porcentaje de ajuste de precio (positivo o negativo)',
    example: 12.5
  })
  @IsNumber()
  percentage: number;

  @ApiProperty({
    description: 'Fecha de inicio de la regla',
    example: '2025-01-01T00:00:00.000Z'
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Fecha de fin de la regla',
    example: '2025-01-31T23:59:59.000Z'
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Indica si la regla está activa',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'ID de la marca asociada',
    example: '9b7fa4dd-3fc3-4e6b-a728-9187f01c91f8'
  })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'ID de la categoría asociada',
    example: 'aa913d44-02fc-4ada-93cb-3a0f53d08b06'
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'ID del usuario que crea la regla',
    example: '32da8bb3-71ad-4e3b-8e6a-b830fe95c6d4'
  })
  @IsUUID()
  @IsOptional()
  createdById?: string;
}
