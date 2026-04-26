import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  Length
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Nombre del proveedor',
    example: 'tiendita SRL'
  })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Nombre del contacto',
    example: 'Gerente Perez'
  })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({
    description: 'Email del proveedor',
    example: 'contacto@tiendita.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '+54 11 5555-5555'
  })
  @IsOptional()
  @IsString()
  @Length(5, 50)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Dirección del proveedor',
    example: 'Av. Siempre Viva 123'
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Identificación tributaria (CUIT, NIT, etc.)',
    example: '20-12345678-9'
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Indica si el proveedor está activo',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
