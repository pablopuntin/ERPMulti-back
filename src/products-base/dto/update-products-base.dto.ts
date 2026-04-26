import { PartialType } from '@nestjs/swagger';
import { CreateProductBaseSimpleDto } from './create-product-base-simple.dto';

export class UpdateProductsBaseDto extends PartialType(
  CreateProductBaseSimpleDto
) {}
