import { IsOptional, IsString } from 'class-validator';

export class ListAccountEntriesDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}
