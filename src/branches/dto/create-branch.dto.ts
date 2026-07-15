import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsBoolean
} from 'class-validator';
import { BranchType } from '../entities/branch.entity';

export class CreateBranchDto {
  @ApiProperty({
    example: 'Sucursal Central',
    description: 'Nombre de la sucursal'
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Av. Principal 123, Buenos Aires',
    description: 'Dirección de la sucursal',
    required: false
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: '+54 11 1234-5678',
    description: 'Teléfono de la sucursal',
    required: false
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'central@example.com',
    description: 'Email de la sucursal',
    required: false
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    enum: BranchType,
    example: BranchType.BRANCH,
    description: 'Tipo de sucursal',
    default: BranchType.BRANCH
  })
  @IsEnum(BranchType)
  type: BranchType = BranchType.BRANCH;

  @ApiProperty({
    example: {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '09:00', close: '13:00' },
      sunday: { open: '09:00', close: '13:00' }
    },
    description: 'Horarios de atención',
    required: false
  })
  @IsOptional()
  @IsObject()
  openingHours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };

  @ApiProperty({
    example: 50000,
    description: 'Saldo inicial de apertura de caja',
    default: 0
  })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @ApiProperty({
    example: 'user-uuid',
    description: 'ID del gerente de la sucursal',
    required: false
  })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({
    example: false,
    description:
      'Si está activo, la sucursal solo puede generar ventas por el stock disponible local',
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  restrictSalesToBranchStock?: boolean;
}
