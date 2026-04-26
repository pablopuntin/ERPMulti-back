import { IsOptional, IsDateString } from 'class-validator';

export class ReportFilterDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
