import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { CashModule } from '../cash/cash.module';
import { AccountModule } from 'src/account/account.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order]),
    OrdersModule, // para poder inyectar OrdersService y validar orden
    UsersModule, // para validar usuario que paga
    CashModule,
    AccountModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
