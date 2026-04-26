import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Nombre de la categoria',
    example: 'Sahumerios',
    required: true
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'descripcion de la categoria',
    example: 'Sahumerios en todas sus variantes',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Url de la imagen de la categoria',
    example:
      'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
    required: false
  })
  @IsOptional()
  @IsUrl()
  imgURL: string;
}
