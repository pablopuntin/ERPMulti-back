import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { RemitosService } from './remitos.service';

@ApiTags('Remitos')
@UseGuards(AuthGuard('jwt'))
@Controller('remitos')
export class RemitosController {
  constructor(private readonly remitosService: RemitosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar remitos' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filtrar por sucursal' })
  @ApiQuery({ name: 'saleId', required: false, description: 'Filtrar por venta' })
  @ApiQuery({ name: 'orderId', required: false, description: 'Filtrar por orden' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filtrar por cliente' })
  findAll(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
    @Query('saleId') saleId?: string,
    @Query('orderId') orderId?: string,
    @Query('customerId') customerId?: string
  ) {
    return this.remitosService.findAll(req.user as any, {
      branchId,
      saleId,
      orderId,
      customerId
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un remito por ID' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.remitosService.findOne(req.user as any, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar PDF de un remito' })
  async getPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const { remito, pdfBuffer, fileName } = await this.remitosService.getPdf(req.user as any, id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Remito-Id', remito.id);

    return res.send(pdfBuffer);
  }
}
