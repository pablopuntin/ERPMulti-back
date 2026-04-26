import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { BranchUser } from './entities/branch-user.entity';
import { StockLocation } from './entities/stock-location.entity';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { BranchSeeder } from '../common/seeds/seed.branches';
import { BranchValidationMiddleware } from '../auth/middleware/branch-validation.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, BranchUser, StockLocation])],
  controllers: [BranchesController],
  providers: [BranchesService, BranchSeeder, BranchValidationMiddleware],
  exports: [BranchesService, BranchValidationMiddleware]
})
export class BranchesModule {
  configure(consumer: MiddlewareConsumer) {
    // Middleware eliminado - la protección por sucursal se manejará desde JWT
  }
}
