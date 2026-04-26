import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards
} from '@nestjs/common';
import { PurchasesService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { Request } from 'express';

@ApiTags('Purchases')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @Post()
  @ApiOperation({
    summary:
      'Registrar una nueva compra por supplier, aumenta el stock y descuenta de caja'
  })
  create(@Req() req: Request, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(req.user as any, dto);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @Get()
  @ApiOperation({ summary: 'Listar todas las compras' })
  findAll(@Req() req: Request) {
    return this.purchasesService.findAll(req.user as any);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una compra por ID' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.purchasesService.findOne(req.user as any, id);
  }
}
