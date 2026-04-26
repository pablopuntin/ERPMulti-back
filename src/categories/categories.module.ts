import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
//import { InitialSeederCategories } from 'src/common/seeds/seed.categories';
import { BrandsService } from 'src/brands/brands.service';
import { BrandsModule } from 'src/brands/brands.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), BrandsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [TypeOrmModule, CategoriesService]
})
export class CategoriesModule {}
