import { Controller, Get, Param } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Price History')
@Controller('price-history')
export class PriceHistoryController {
  constructor(private readonly service: PriceHistoryService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('variant/:id')
  findByVariant(@Param('id') id: string) {
    return this.service.findByVariant(id);
  }
}
