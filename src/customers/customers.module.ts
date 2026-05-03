import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer } from './entities/customer.entity';
import { CustomerBranch } from './entities/customer-branch.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { AccountModule } from 'src/account/account.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerBranch, Branch]),
    AccountModule
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService]
})
export class CustomersModule {}
