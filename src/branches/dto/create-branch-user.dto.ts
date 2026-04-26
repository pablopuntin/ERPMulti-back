import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject
} from 'class-validator';
import { BranchUserRole } from '../entities/branch-user.entity';

export class CreateBranchUserDto {
  @ApiProperty({
    enum: BranchUserRole,
    example: BranchUserRole.MANAGER,
    description: 'Rol del usuario en la sucursal'
  })
  @IsEnum(BranchUserRole)
  role: BranchUserRole;

  @ApiProperty({
    example: {
      canViewAllBranches: false,
      canManageProducts: false,
      canManageUsers: false,
      canViewReports: true,
      canManageCash: true,
      canManageExpenses: false
    },
    description: 'Permisos específicos del usuario',
    required: false
  })
  @IsOptional()
  @IsObject()
  permissions?: {
    canViewAllBranches?: boolean;
    canManageProducts?: boolean;
    canManageUsers?: boolean;
    canViewReports?: boolean;
    canManageCash?: boolean;
    canManageExpenses?: boolean;
  };

  @ApiProperty({
    example: true,
    description: 'Indica si la asignación está activa',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({
    example: 'Gerente de la sucursal central',
    description: 'Notas adicionales sobre la asignación',
    required: false
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: 'branch-uuid',
    description: 'ID de la sucursal'
  })
  @IsString()
  branchId: string;

  @ApiProperty({
    example: 'user-uuid',
    description: 'ID del usuario'
  })
  @IsString()
  userId: string;
}
