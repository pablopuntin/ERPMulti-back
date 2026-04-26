import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';
import { CashRegister } from './entities/cash-register.entity';
import { CashMovement } from './entities/cash-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashRegister, CashMovement])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService]
})
export class CashModule {}
