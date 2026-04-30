import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remito } from './entities/remito.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { RemitosController } from './remitos.controller';
import { RemitoPdfService } from './remito-pdf.service';
import { RemitosService } from './remitos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Remito, RemitoItem])],
  controllers: [RemitosController],
  providers: [RemitosService, RemitoPdfService],
  exports: [RemitosService]
})
export class RemitosModule {}
