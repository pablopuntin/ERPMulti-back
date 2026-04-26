import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { PriceChangeHistory } from 'src/price-history/entities/price-history.entity';
import { CashMovement } from 'src/cash/entities/cash-movement.entity';
import { CashRegister } from 'src/cash/entities/cash-register.entity';
import { Order } from 'src/orders/entities/order.entity';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import { PurchaseItem } from 'src/purchase/entities/purchase-item.entity';
import { Category } from 'src/categories/entities/category.entity';
import { Brand } from 'src/brands/entities/brand.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { ProductsBaseModule } from 'src/products-base/products-base.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductVariant,
      PriceChangeHistory,
      CashMovement,
      CashRegister,
      Order,
      OrderItem,
      PurchaseItem,
      Category,
      Brand,
      Branch
    ]),
    ProductsBaseModule
  ],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
