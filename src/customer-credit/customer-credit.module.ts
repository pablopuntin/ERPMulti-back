import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { CustomerCreditDocument } from './entities/customer-credit-document.entity';
import { CustomerCreditMovement } from './entities/customer-credit-movement.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { CashModule } from 'src/cash/cash.module';
import { CustomerCreditService } from './customer-credit.service';
import { CustomerCreditReceipt } from './entities/customer-credit-receipt.entity';
import { CustomerCreditReceiptItem } from './entities/customer-credit-receipt-item.entity';
import { CustomerCreditReceiptPdfService } from './customer-credit-receipt-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerCreditDocument,
      CustomerCreditMovement,
      CustomerCreditReceipt,
      CustomerCreditReceiptItem,
      Payment,
      Order
    ]),
    CashModule
  ],
  providers: [CustomerCreditService, CustomerCreditReceiptPdfService],
  exports: [CustomerCreditService]
})
export class CustomerCreditModule {}
