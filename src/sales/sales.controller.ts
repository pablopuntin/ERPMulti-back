import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@UseGuards(AuthGuard('jwt'))
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar ventas' })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Sucursal específica. Solo para usuarios con alcance global.'
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    description: 'Filtrar por cliente'
  })
  findAll(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
    @Query('customerId') customerId?: string
  ) {
    return this.salesService.findAll(req.user as any, { branchId, customerId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una venta por ID' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.salesService.findOne(req.user as any, id);
  }
}
