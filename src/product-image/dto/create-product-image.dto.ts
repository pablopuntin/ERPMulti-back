import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID
} from 'class-validator';

export class CreateProductImageDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsUUID()
  variantId: string;
}
