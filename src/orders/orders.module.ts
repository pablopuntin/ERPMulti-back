import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderDeliveryEvent } from './entities/order-delivery-event.entity';
import { OrderDeliveryEventItem } from './entities/order-delivery-event-item.entity';
import { StockModule } from 'src/stock/stock.module';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { User } from 'src/users/entities/user.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { CashModule } from 'src/cash/cash.module';
import { AccountModule } from 'src/account/account.module';
import { Branch } from 'src/branches/entities/branch.entity';
import { SalesModule } from 'src/sales/sales.module';
import { RemitosModule } from 'src/remitos/remitos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderDeliveryEvent,
      OrderDeliveryEventItem,
      ProductVariant,
      User,
      Customer,
      Payment,
      Branch
    ]),
    StockModule,
    CashModule,
    AccountModule,
    SalesModule,
    RemitosModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
