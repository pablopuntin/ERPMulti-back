import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceRulesService } from './price-rules.service';
import { PriceRulesController } from './price-rules.controller';
import { PriceRule } from './entities/price-rule.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { PriceHistoryModule } from 'src/price-history/price-history.module';
import { Brand } from 'src/brands/entities/brand.entity';
import { Category } from 'src/categories/entities/category.entity';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PriceRule,
      ProductVariant,
      Brand,
      Category,
      User
    ]),
    forwardRef(() => PriceHistoryModule)
  ],
  controllers: [PriceRulesController],
  providers: [PriceRulesService],
  exports: [PriceRulesService]
})
export class PriceRulesModule {}
