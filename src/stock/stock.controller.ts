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
@Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero', 'vendedor')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // === CRUD PRINCIPAL ===

  @Post()
  @ApiOperation({
    summary:
      'Registrar un nuevo movimiento de stock (entrada / salida / ajuste)'
  })
  create(@Body() dto: CreateStockMovementDto) {
    return this.stockService.create(dto);
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Transferir stock de una ubicación a otra para una variante'
  })
  transfer(@Body() dto: TransferStockDto) {
    return this.stockService.transfer(dto);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Listar historial de transferencias de stock' })
  findAllTransfers() {
    return this.stockService.findAllTransfers();
  }

  @Get('transfers/:id')
  @ApiOperation({ summary: 'Obtener una transferencia de stock por ID' })
  findTransferById(@Param('id') id: string) {
    return this.stockService.findTransferById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los movimientos de stock' })
  findAll() {
    return this.stockService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento de stock por ID' })
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los datos de un movimiento de stock' })
  update(@Param('id') id: string, @Body() dto: UpdateStockMovementDto) {
    return this.stockService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un movimiento de stock (no afecta el inventario)'
  })
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }

  // === ALERTAS DE STOCK ===

  @Get('/alerts/active')
  @ApiOperation({ summary: 'Listar todas las alertas activas de bajo stock' })
  getActiveAlerts() {
    return this.stockService.getActiveAlerts();
  }

  @Patch('/alerts/resolve/:variantId')
  @ApiOperation({
    summary: 'Resolver alertas de una variante cuando se repone el stock'
  })
  resolveAlert(@Param('variantId') variantId: string) {
    return this.stockService.resolveAlert(variantId);
  }
}
