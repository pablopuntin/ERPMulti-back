// import { IsString, IsOptional, IsUrl, IsArray, IsUUID } from 'class-validator';
// import { ApiProperty } from '@nestjs/swagger';

// export class CreateBrandDto {
//    @ApiProperty({
//       description: 'Nombre de la marca',
//       example: 'Saphirus',
//        required: true
//     })
//   @IsString()
//   name: string;

//     @ApiProperty({
//       description: 'descripcion de la marca',
//       example: 'Saphirus, marca lider',
//        required: false
//     })
//   @IsOptional()
//   @IsString()
//   description?: string;

//     @ApiProperty({
//       description: 'Url de la imagen de la marca',
//       example: 'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
//        required: false
//     })
//   @IsOptional()
//   @IsUrl()
//   imgURL: string;

//   @ApiProperty({
//     description: "IDs de categorías a asociar con esta marca",
//     example: ["uuid-cat-1", "uuid-cat-2"]
//   })
//   @IsArray()
//   @IsUUID("4", { each: true })
//   categoryIds: string[];

//   //  @ApiProperty({ type: () => [CategoryDto] })
//   // categories: CategoryDto[];

//   // @ApiProperty({ type: () => [ProductsBaseDto] })
//   // productsBase: ProductsBaseDto[];
// }

//refactor
import { IsString, IsOptional, IsUrl, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({ example: 'Pepito' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Marca líder en sahumerios', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'https://misimagenes.com/logo.jpg',
    required: false
  })
  @IsOptional()
  @IsUrl()
  imgURL?: string;

  @ApiProperty({
    example: 'uuid-de-categoria',
    required: false,
    description: 'Se ignora si usás el endpoint /categories/:id/brands'
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
