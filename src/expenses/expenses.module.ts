import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { FixedExpense } from './entities/fixed-expense.entity';
import { VariableExpense } from './entities/variable-expense.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { CashModule } from 'src/cash/cash.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FixedExpense, VariableExpense, Supplier]),
    CashModule
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService]
})
export class ExpensesModule {}
