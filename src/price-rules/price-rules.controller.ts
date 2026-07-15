import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete
} from '@nestjs/common';
import { PriceRulesService } from './price-rules.service';
import { CreatePriceRuleDto } from './dto/create-price-rule.dto';
import { UpdatePriceRuleDto } from './dto/update-price-rule.dto';

@Controller('price-rules')
export class PriceRulesController {
  constructor(private readonly priceRulesService: PriceRulesService) {}

  @Post()
  create(@Body() dto: CreatePriceRuleDto) {
    return this.priceRulesService.create(dto);
  }

  @Get()
  findAll() {
    return this.priceRulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.priceRulesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriceRuleDto) {
    return this.priceRulesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priceRulesService.remove(id);
  }

  @Post('apply')
  apply() {
    return this.priceRulesService.applyActiveRules();
  }
}
