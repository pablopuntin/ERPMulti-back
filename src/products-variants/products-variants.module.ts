import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariant } from './entities/products-variant.entity';
import { ProductsVariantsService } from './products-variants.service';
import { ProductsVariantsController } from './products-variants.controller';
import { ProductsBase } from 'src/products-base/entities/products-base.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { ProductVariantBranch } from './entities/product-variant-branch.entity';
import { PriceHistoryModule } from 'src/price-history/price-history.module';
import { StockModule } from 'src/stock/stock.module';
import { ProductSeedService } from 'src/common/seeds/product-seed-multiSuc';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductVariant,
      ProductsBase,
      Branch,
      StockLocation,
      ProductVariantBranch
    ]),
    forwardRef(() => PriceHistoryModule),
    forwardRef(() => StockModule)
  ],
  controllers: [ProductsVariantsController],
  providers: [ProductsVariantsService, ProductSeedService],
  exports: [ProductsVariantsService]
})
export class ProductsVariantsModule {}
