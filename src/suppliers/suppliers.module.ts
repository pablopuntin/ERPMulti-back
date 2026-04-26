// src/suppliers/suppliers.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { StockModule } from 'src/stock/stock.module';
import { CashModule } from 'src/cash/cash.module';
import { PurchaseModule } from 'src/purchase/purchase.module';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierProduct, ProductVariant, User]),

    // 🔥 Necesarios porque SuppliersService los usa
    forwardRef(() => StockModule),
    forwardRef(() => CashModule),

    // Si también usás Purchase
    forwardRef(() => PurchaseModule)
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService, TypeOrmModule]
})
export class SuppliersModule {}
