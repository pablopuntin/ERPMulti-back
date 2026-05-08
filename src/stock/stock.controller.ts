import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { UpdateStockMovementDto } from './dto/update-stock.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Stock Management')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // === CRUD PRINCIPAL ===

  @Post()
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({
    summary:
      'Registrar un nuevo movimiento de stock (entrada / salida / ajuste)'
  })
  create(@Body() dto: CreateStockMovementDto) {
    return this.stockService.create(dto);
  }

  @Post('transfer')
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({
    summary: 'Transferir stock de una ubicación a otra para una variante'
  })
  transfer(@Body() dto: TransferStockDto) {
    return this.stockService.transfer(dto);
  }

  @Get('transfers')
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({ summary: 'Listar historial de transferencias de stock' })
  findAllTransfers() {
    return this.stockService.findAllTransfers();
  }

  @Get('transfers/:id')
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({ summary: 'Obtener una transferencia de stock por ID' })
  findTransferById(@Param('id') id: string) {
    return this.stockService.findTransferById(id);
  }

  @Get()
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  @ApiOperation({ summary: 'Listar todos los movimientos de stock' })
  findAll() {
    return this.stockService.findAll();
  }

  @Get(':id')
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  @ApiOperation({ summary: 'Obtener un movimiento de stock por ID' })
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Patch(':id')
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({ summary: 'Actualizar los datos de un movimiento de stock' })
  update(@Param('id') id: string, @Body() dto: UpdateStockMovementDto) {
    return this.stockService.update(id, dto);
  }

  @Delete(':id')
  @Roles('root')
  @ApiOperation({
    summary: 'Eliminar un movimiento de stock (no afecta el inventario)'
  })
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }

  // === ALERTAS DE STOCK ===

  @Get('/alerts/active')
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  @ApiOperation({ summary: 'Listar todas las alertas activas de bajo stock' })
  getActiveAlerts() {
    return this.stockService.getActiveAlerts();
  }

  @Patch('/alerts/resolve/:variantId')
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @ApiOperation({
    summary: 'Resolver alertas de una variante cuando se repone el stock'
  })
  resolveAlert(@Param('variantId') variantId: string) {
    return this.stockService.resolveAlert(variantId);
  }
}
