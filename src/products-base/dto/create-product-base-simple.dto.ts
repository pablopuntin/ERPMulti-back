import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateProductBaseSimpleDto {
  @ApiProperty({
    example: 'Destornillador Bosch',
    description: 'Nombre del producto base'
  })
  @IsString()
  name: string;

  @ApiProperty({
    example:
      'Destornillador profesional con mango ergonómico para trabajos precisos',
    description: 'Descripción detallada del producto',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'category-uuid',
    description: 'ID de la categoría'
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: 'brand-uuid',
    description: 'ID de la marca'
  })
  @IsUUID()
  brandId: string;

  @ApiProperty({
    example: 'https://example.com/image.jpg',
    description: 'URL de imagen principal del producto base',
    required: false
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el producto base está activo',
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
