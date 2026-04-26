import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductImagesService } from './product-image.service';
import { ProductImagesController } from './product-image.controller';
import { ProductImage } from './entities/product-image.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductImage, ProductVariant])],
  controllers: [ProductImagesController],
  providers: [ProductImagesService],
  exports: [ProductImagesService]
})
export class ProductImagesModule {}
