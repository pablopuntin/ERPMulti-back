import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateFixedExpenseDto {
  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
