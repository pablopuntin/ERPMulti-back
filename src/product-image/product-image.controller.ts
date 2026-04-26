import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete
} from '@nestjs/common';
import { ProductImagesService } from './product-image.service';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Product Images')
@Controller('product-images')
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post()
  create(@Body() dto: CreateProductImageDto) {
    return this.productImagesService.create(dto);
  }

  @Get()
  findAll() {
    return this.productImagesService.findAll();
  }

  @Get('variant/:variantId')
  findByVariant(@Param('variantId') variantId: string) {
    return this.productImagesService.findByVariant(variantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productImagesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductImageDto) {
    return this.productImagesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productImagesService.remove(id);
  }
}
