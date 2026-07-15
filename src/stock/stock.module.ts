import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockMovement } from './entities/stock.entity';
import { StockAlert } from './entities/stock-alert.entity'; //
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { User } from 'src/users/entities/user.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { ProductVariantBranch } from 'src/products-variants/entities/product-variant-branch.entity';
import { SuppliersModule } from 'src/suppliers/suppliers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockMovement,
      StockAlert,
      StockTransfer,
      ProductVariant,
      Supplier,
      User,
      Branch,
      StockLocation,
      ProductVariantBranch
    ]),
    forwardRef(() => SuppliersModule)
  ],

  controllers: [StockController, StockAdjustmentController],
  providers: [StockService, StockAdjustmentService],
  exports: [StockService, StockAdjustmentService]
})
export class StockModule {}
