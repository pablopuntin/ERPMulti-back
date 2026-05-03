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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntry,
      AccountAdjustment,
      AccountApplication,
      CustomerBranch
    ])
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
