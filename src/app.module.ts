import { ProductImagesModule } from './product-image/product-image.module';
import { StockModule } from './stock/stock.module';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './common/config/database.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CategoriesModule } from './categories/categories.module';
import { ProductsVariantsModule } from './products-variants/products-variants.module';
import { ProductsBaseModule } from './products-base/products-base.module';
import { BrandsModule } from './brands/brands.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PriceHistoryModule } from './price-history/price-history.module';
import { PriceRulesModule } from './price-rules/price-rules.module';
import { ReportsModule } from './reports/reports.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { CashModule } from './cash/cash.module';
import { ExpensesModule } from './expenses/expenses.module';
import { PurchaseModule } from './purchase/purchase.module';
import { BranchesModule } from './branches/branches.module';
import { CustomersModule } from './customers/customers.module';
import { SalesModule } from './sales/sales.module';
import { RemitosModule } from './remitos/remitos.module';
import { UserMiddleware } from './auth/middleware/user.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true, // ✅ lo hace disponible en toda la app
      secret: process.env.JWT_SECRET || 'default_secret',
      signOptions: { expiresIn: '60m' }
    }),
    UsersModule,
    DatabaseModule,
    AuthModule,
    CategoriesModule,
    SuppliersModule,
    ProductsBaseModule,
    ProductsVariantsModule,
    BrandsModule,
    StockModule,
    ProductImagesModule,
    PriceHistoryModule,
    PriceRulesModule,
    ReportsModule,
    OrdersModule,
    PaymentsModule,
    CashModule,
    ExpensesModule,
    PurchaseModule,
    BranchesModule,
    CustomersModule,
    SalesModule,
    RemitosModule
  ],
  controllers: [AppController]
})
export class AppModule {}
