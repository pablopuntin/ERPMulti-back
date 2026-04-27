import { Module } from '@nestjs/common';
import { ProductsBaseService } from './products-base.service';
import { ProductsBaseController } from './products-base.controller';
import { ProductsBase } from './entities/products-base.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from 'src/brands/entities/brand.entity';
import { Category } from 'src/categories/entities/category.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { ProductVariantBranch } from 'src/products-variants/entities/product-variant-branch.entity';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { BranchesModule } from 'src/branches/branches.module';
import { CategoriesModule } from 'src/categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductsBase,
      Brand,
      Category,
      ProductVariant,
      ProductVariantBranch,
      StockLocation,
      Branch
    ]),
    BranchesModule,
    CategoriesModule
  ],
  controllers: [ProductsBaseController],
  providers: [ProductsBaseService],
  exports: [ProductsBaseService] // ✅ Exportar para que otros módulos lo puedan usar
})
export class ProductsBaseModule {}
