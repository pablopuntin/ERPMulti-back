import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString
} from 'class-validator';
import { AccountEntryDirection } from '../entities/account-entry.entity';
import { AccountAdjustmentType } from '../entities/account-adjustment.entity';

export class CreateAccountAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(AccountAdjustmentType)
  adjustmentType: AccountAdjustmentType;

  @IsEnum(AccountEntryDirection)
  direction: AccountEntryDirection;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  authorizedByUserId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
