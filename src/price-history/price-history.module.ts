// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { PriceHistoryService } from './price-history.service';
// import { PriceHistoryController } from './price-history.controller';
// import { PriceChangeHistory } from './entities/price-history.entity';

// @Module({
//   imports: [TypeOrmModule.forFeature([PriceChangeHistory])],
//   controllers: [PriceHistoryController],
//   providers: [PriceHistoryService],
//   exports: [PriceHistoryService],
// })
// export class PriceHistoryModule {}

//refactor
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceHistoryService } from './price-history.service';
import { PriceHistoryController } from './price-history.controller';
import { PriceChangeHistory } from './entities/price-history.entity';
import { PriceRulesModule } from 'src/price-rules/price-rules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceChangeHistory]),
    forwardRef(() => PriceRulesModule)
  ],
  controllers: [PriceHistoryController],
  providers: [PriceHistoryService],
  exports: [PriceHistoryService]
})
export class PriceHistoryModule {}
