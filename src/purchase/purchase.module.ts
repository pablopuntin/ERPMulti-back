import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PurchasesService } from './purchase.service';
import { PurchasesController } from './purchase.controller';
import { SuppliersModule } from 'src/suppliers/suppliers.module';
import { UsersModule } from 'src/users/users.module';
import { StockModule } from 'src/stock/stock.module';
import { CashModule } from 'src/cash/cash.module';
import { ProductsVariantsModule } from 'src/products-variants/products-variants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, PurchaseItem]),

    forwardRef(() => SuppliersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => StockModule),
    forwardRef(() => CashModule),
    forwardRef(() => ProductsVariantsModule)
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService]
})
export class PurchaseModule {}
