// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { CustomerBranch } from 'src/customers/entities/customer-branch.entity';
// import { AccountController } from './account.controller';
// import { AccountAdjustment } from './entities/account-adjustment.entity';
// import { AccountApplication } from './entities/account-application.entity';
// import { AccountEntry } from './entities/account-entry.entity';
// import { AccountAdjustmentsService } from './services/account-adjustments.service';
// import { AccountLedgerService } from './services/account-ledger.service';
// import { AccountStatementService } from './services/account-statement.service';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([
//       AccountEntry,
//       AccountAdjustment,
//       AccountApplication,
//       CustomerBranch
//     ])
//   ],
//   controllers: [AccountController],
//   providers: [
//     AccountLedgerService,
//     AccountAdjustmentsService,
//     AccountStatementService
//   ],
//   exports: [
//     AccountLedgerService,
//     AccountAdjustmentsService,
//     AccountStatementService
//   ]
// })
// export class AccountModule {}

//ref
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerBranch } from 'src/customers/entities/customer-branch.entity';
import { AccountController } from './account.controller';
import { AccountAdjustment } from './entities/account-adjustment.entity';
import { AccountApplication } from './entities/account-application.entity';
import { AccountEntry } from './entities/account-entry.entity';
import { AccountAdjustmentsService } from './services/account-adjustments.service';
import { AccountLedgerService } from './services/account-ledger.service';
import { AccountStatementService } from './services/account-statement.service';
// 1. Importamos el CashModule
import { CashModule } from 'src/cash/cash.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntry,
      AccountAdjustment,
      AccountApplication,
      CustomerBranch
    ]),
    // 2. Agregamos CashModule en los imports para que AccountLedgerService pueda usar el CashService
    CashModule 
  ],
  controllers: [AccountController],
  providers: [
    AccountLedgerService,
    AccountAdjustmentsService,
    AccountStatementService
  ],
  exports: [
    AccountLedgerService,
    AccountAdjustmentsService,
    AccountStatementService
  ]
})
export class AccountModule {}