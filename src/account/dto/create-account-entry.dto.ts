import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString
} from 'class-validator';
import {
  AccountEntryDirection,
  AccountEntrySourceModule,
  AccountEntryType
} from '../entities/account-entry.entity';

export class CreateAccountEntryDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(AccountEntryType)
  entryType: AccountEntryType;

  @IsEnum(AccountEntryDirection)
  entryDirection: AccountEntryDirection;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(AccountEntrySourceModule)
  sourceModule: AccountEntrySourceModule;

  @IsString()
  @IsNotEmpty()
  sourceEntityType: string;

  @IsString()
  @IsNotEmpty()
  sourceEntityId: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsOptional()
  cashierUserId?: string;

  @IsString()
  @IsOptional()
  reasonCode?: string;

  @IsString()
  @IsOptional()
  reasonText?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  reversedByEntryId?: string;
}
