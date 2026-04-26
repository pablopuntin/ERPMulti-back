import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateVariableExpenseDto {
  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
