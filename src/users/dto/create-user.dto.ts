import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsDateString,
  IsString,
  IsPostalCode,
  IsEnum,
  IsArray,
  IsBoolean,
  IsUUID
} from 'class-validator';
import { Role } from '../entities/role.entity';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional
} from '@nestjs/swagger';

export enum Gender {
  Male = 'male',
  Female = 'female',
  Other = 'other'
}

export enum UserRoleName {
  ROOT = 'root',
  GERENTE_GENERAL = 'gerente_general',
  GERENTE_SUCURSAL = 'gerente_sucursal',
  VENDEDOR = 'vendedor',
  CAJERO = 'cajero'
}

export class CreateUserDto {
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan'
  })
  @IsNotEmpty()
  firstname: string;

  @ApiProperty({
    description: 'Apellido del usuario',
    example: 'Perez'
  })
  @IsNotEmpty()
  lastname: string;

  @ApiProperty({
    description: 'Correo electrónico',
    example: 'juanperez@mail.com'
  })
  @IsEmail({}, { message: 'Email must be valid' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario interno',
    example: 'mySecurePassword123'
  })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiPropertyOptional({
    description: 'Rol asignado al usuario',
    type: () => Role
  })
  @ApiHideProperty()
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    description: 'Nombre del rol final del usuario',
    enum: UserRoleName,
    example: UserRoleName.CAJERO
  })
  @IsOptional()
  @IsEnum(UserRoleName)
  roleName?: UserRoleName;

  @ApiPropertyOptional({
    description: 'Sucursales asignadas al usuario',
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      'a3bb189e-8bf9-3888-9912-ace4e6543002'
    ]
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: 'Cada branchId debe ser un UUID válido'
  })
  branchIds?: string[];

  @ApiPropertyOptional({
    description:
      'Otorga acceso global a todas las sucursales actuales y futuras',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  globalBranchAccess?: boolean;

  // -------- DATOS PERSONALES OPCIONALES --------

  @ApiPropertyOptional({
    description: 'Número de teléfono (Argentina)',
    example: '+54 9 11 1234 5678'
  })
  @IsOptional()
  @IsPhoneNumber('AR', { message: 'Phone number must be valid for Argentina' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Dirección línea 1',
    example: 'Av. Siempre Viva 742'
  })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Dirección línea 2',
    example: 'Depto 3B'
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'Ciudad',
    example: 'Buenos Aires'
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Estado o provincia',
    example: 'Buenos Aires'
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'País',
    example: 'Argentina'
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Código postal',
    example: '1414'
  })
  @IsOptional()
  @IsPostalCode('any', { message: 'Postal code must be valid' })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento (ISO string)',
    example: '1990-05-20'
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid ISO date' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Género del usuario',
    example: 'male',
    enum: Gender
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be male, female, or other' })
  gender?: Gender;
}
