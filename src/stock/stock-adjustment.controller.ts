import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { StockAdjustmentService } from './stock-adjustment.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import type { Request } from 'express';

@ApiTags('Stock Adjustment')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stock/adjustments')
export class StockAdjustmentController {
  constructor(private readonly stockAdjustmentService: StockAdjustmentService) {}

  @Post()
  @Roles('root', 'gerente_general')
  @ApiOperation({
    summary: 'Ajustar inventario (reconciliación stock real vs sistema)',
    description: 'Solo root y gerente_general pueden hacer ajustes de inventario. Motivo obligatorio. Alerta si ajuste > 20% del stock total.'
  })
  create(@Req() req: Request, @Body() dto: CreateAdjustmentDto) {
    const user = req.user as any;
    return this.stockAdjustmentService.adjustStock(user, dto);
  }

  @Get('history')
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({
    summary: 'Historial de ajustes de inventario',
    description: 'Ver todos los ajustes de stock realizados, opcionalmente filtrados por variante o sucursal'
  })
  @ApiQuery({ name: 'variantId', required: false, description: 'Filtrar por ID de variante' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filtrar por ID de sucursal' })
  getHistory(@Query() filters: { variantId?: string; branchId?: string }) {
    return this.stockAdjustmentService.getAdjustmentHistory(filters);
  }
}
