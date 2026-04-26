// //refactor
// import { Controller, Get, Query } from '@nestjs/common';
// import { ReportsService } from './reports.service';
// import { ApiTags, ApiOperation } from '@nestjs/swagger';
// import { ApiQuery } from '@nestjs/swagger';

// @ApiTags('Reports')
// @Controller('reports')
// export class ReportsController {
//   constructor(private readonly service: ReportsService) {}

//   @Get('stock')
// @ApiOperation({ summary: 'Resumen consolidado de stock por producto' })
// @ApiQuery({
//   name: 'search',
//   required: false,
//   type: String,
// })
// @ApiQuery({
//   name: 'order',
//   required: false,
//   enum: ['asc', 'desc'],
//   default: 'desc',
// })
// getStockSummary(
//   @Query('search') search?: string,
//   @Query('order') order: 'asc' | 'desc' = 'desc',
// ) {
//   return this.service.getStockSummary(search, order);
// }

//refactor
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CashMovementType } from 'src/cash/entities/cash-movement.entity';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { SalesReportFiltersDto } from './dto/sales-reports.dto';

@ApiTags('Reports')
@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─────────────────────────────────────────────
  // 1. FINANCE REPORT (INGRESOS/EGRESOS/BALANCE)
  // ─────────────────────────────────────────────
  @Get('finance')
  @ApiOperation({ summary: 'Resumen financiero' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial (opcional, por defecto inicio del año actual)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final (opcional, por defecto fin del año actual)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description:
      'Sucursal específica. Solo disponible para usuarios con alcance global.'
  })
  getFinanceReport(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.getFinanceReport(
      req.user as any,
      from,
      to,
      branchId
    );
  }

  // ─────────────────────────────────────────────
  // 2. CASH MOVEMENTS (LISTADO)
  // ─────────────────────────────────────────────
  @Get('cash-movements')
  @ApiOperation({
    summary: 'Listado de movimientos de caja',
    description:
      'Permite obtener ingresos o egresos, filtrando opcionalmente por tipo y rango de fechas.'
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CashMovementType,
    description: 'Tipo de movimiento: INCOME o EXPENSE'
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial del rango. (Opcional)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final del rango. (Opcional)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description:
      'Sucursal específica. Solo disponible para usuarios con alcance global.'
  })
  getCashMovements(
    @Req() req: Request,
    @Query('type') type?: CashMovementType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.getCashMovements(
      req.user as any,
      type,
      from,
      to,
      branchId
    );
  }

  // ─────────────────────────────────────────────
  // 3. PROFIT REPORT (GANANCIA)
  // ─────────────────────────────────────────────
  @Get('profit')
  @ApiOperation({ summary: 'Reporte de ganancia' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial (opcional)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final (opcional)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description:
      'Sucursal específica. Solo disponible para usuarios con alcance global.'
  })
  getProfit(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.getProfit(req.user as any, from, to, branchId);
  }
  // ─────────────────────────────────────────────
  // 4. DAILY SUMMARY (RESUMEN DE UNA FECHA)
  // ─────────────────────────────────────────────
  @Get('daily')
  @ApiOperation({ summary: 'Resumen financiero diario' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Fecha (opcional, por defecto día actual)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description:
      'Sucursal específica. Solo disponible para usuarios con alcance global.'
  })
  getDailySummary(
    @Req() req: Request,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.getDailySummary(req.user as any, date, branchId);
  }

  // ─────────────────────────────────────────────
  // 5. PRICE CHANGES REPORT
  // ─────────────────────────────────────────────
  @Get('price-changes')
  @ApiOperation({
    summary: 'Historial de cambios de precio',
    description: 'Muestra los cambios de precio en un rango opcional de fechas.'
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial del rango (opcional)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final del rango (opcional)'
  })
  getPriceChanges(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getPriceChanges({ from, to });
  }

  // ─────────────────────────────────────────────
  // 6. STOCK SUMMARY
  // ─────────────────────────────────────────────
  @Get('stock')
  @ApiOperation({
    summary: 'Resumen consolidado de stock',
    description:
      'Agrupa el stock por producto y muestra variantes, filtrando opcionalmente por nombre y ordenando por cantidad.'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nombre del producto'
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Ordenar por total de stock',
    example: 'desc'
  })
  getStockSummary(
    @Query('search') search?: string,
    @Query('order') order: 'asc' | 'desc' = 'desc'
  ) {
    return this.reportsService.getStockSummary(search, order);
  }

  // //////////////////////////////////////////////////////////////////////////////////////
  // 7. VENTAS POR PRODUCTOS (con márgenes)
  // //////////////////////////////////////////////////////////////////////////////////////
  @Get('sales/products')
  @ApiOperation({
    summary: 'Reporte de ventas por productos',
    description:
      'Ventas detalladas por producto con márgenes, categorías y marcas. Respetando scope multi sucursal.'
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filtrar por categoría específica'
  })
  @ApiQuery({
    name: 'brandId',
    required: false,
    description: 'Filtrar por marca específica'
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filtrar por producto específico'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nombre de producto o SKU'
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Sucursal específica. Solo para usuarios con alcance global.'
  })
  getSalesByProducts(
    @Req() req: Request,
    @Query() filters: SalesReportFiltersDto
  ) {
    return this.reportsService.getSalesByProducts(req.user as any, filters);
  }

  // //////////////////////////////////////////////////////////////////////////////////////
  // 8. VENTAS POR CATEGORÍAS
  // //////////////////////////////////////////////////////////////////////////////////////
  @Get('sales/categories')
  @ApiOperation({
    summary: 'Reporte de ventas por categorías',
    description:
      'Ventas agrupadas por categoría. Respetando scope multi sucursal.'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nombre de categoría'
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Sucursal específica. Solo para usuarios con alcance global.'
  })
  getSalesByCategories(
    @Req() req: Request,
    @Query() filters: SalesReportFiltersDto
  ) {
    return this.reportsService.getSalesByCategories(req.user as any, filters);
  }

  // //////////////////////////////////////////////////////////////////////////////////////
  // 9. VENTAS POR MARCAS
  // //////////////////////////////////////////////////////////////////////////////////////
  @Get('sales/brands')
  @ApiOperation({
    summary: 'Reporte de ventas por marcas',
    description: 'Ventas agrupadas por marca. Respetando scope multi sucursal.'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nombre de marca'
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Sucursal específica. Solo para usuarios con alcance global.'
  })
  getSalesByBrands(
    @Req() req: Request,
    @Query() filters: SalesReportFiltersDto
  ) {
    return this.reportsService.getSalesByBrands(req.user as any, filters);
  }
}
