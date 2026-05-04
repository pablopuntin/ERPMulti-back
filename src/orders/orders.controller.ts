import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { FinalizeSaleUseCase } from './use-cases/finalize-sale.use-case';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import { FinalizeOrderDto } from './dto/finalize-order.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@ApiTags('Orders')
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly finalizeSaleUseCase: FinalizeSaleUseCase
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva orden de venta' })
  create(@Req() req: Request, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user as any, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las órdenes' })
  findAll(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.ordersService.findAll(req.user as any, branchId);
  }

  @Get('cash/queue')
  @ApiOperation({ summary: 'Obtener cola de remitos pendientes para caja' })
  getCashQueue(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.ordersService.getCashQueue(req.user as any, branchId);
  }

  @Get('cash/pending-deliveries')
  @ApiOperation({ summary: 'Obtener remitos pagos con entrega pendiente' })
  getPendingDeliveries(
    @Req() req: Request,
    @Query('branchId') branchId?: string
  ) {
    return this.ordersService.getPendingDeliveries(req.user as any, branchId);
  }

  @Get('seller/metrics')
  @ApiOperation({ summary: 'Obtener métricas de ventas cerradas por vendedor' })
  getSellerMetrics(
    @Req() req: Request,
    @Query('sellerUserId') sellerUserId?: string,
    @Query('branchId') branchId?: string
  ) {
    return this.ordersService.getSellerMetrics(
      req.user as any,
      sellerUserId,
      branchId
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden por ID' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.ordersService.findOne(req.user as any, id);
  }

  @Post(':id/send-to-cash')
  @ApiOperation({ summary: 'Enviar remito a caja' })
  sendToCash(@Req() req: Request, @Param('id') id: string) {
    return this.ordersService.sendToCash(req.user as any, id);
  }

  @Post(':id/review')
  @ApiOperation({
    summary: 'Revisar remito en caja con aprobación parcial por ítem'
  })
  reviewInCash(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReviewOrderDto
  ) {
    return this.ordersService.reviewInCash(req.user as any, id, dto);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'Registrar entrega desde caja' })
  deliverInCash(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: DeliverOrderDto
  ) {
    return this.ordersService.deliverInCash(req.user as any, id, dto);
  }

  @Post(':id/finalize')
  @ApiOperation({
    summary: 'Finalizar transacción en caja, emitir o reimprimir remito'
  })
  finalizeInCash(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: FinalizeOrderDto
  ) {
    return this.finalizeSaleUseCase.execute(req.user as any, id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar estado de una orden' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto
  ) {
    return this.ordersService.update(req.user as any, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una orden' })
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.ordersService.remove(req.user as any, id);
  }
}
