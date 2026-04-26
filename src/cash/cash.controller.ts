import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CashService } from './cash.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { AuthSwagger } from 'src/auth/decorators/auth-swagger.decorator';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@ApiTags('Cash Register')
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Post('open')
  @ApiOperation({ summary: 'Abrir una nueva caja' })
  open(
    @Req() req: Request,
    @Body('openingBalance') openingBalance?: number,
    @Body('branchId') branchId?: string
  ) {
    return this.cashService.openRegister(
      req.user as any,
      branchId,
      openingBalance || 0
    );
  }

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Post('close/:id')
  @ApiOperation({ summary: 'Cerrar caja actual' })
  close(@Req() req: Request, @Param('id') id: string) {
    return this.cashService.closeRegister(req.user as any, id);
  }

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Post('movement')
  @ApiOperation({ summary: 'Registrar un movimiento de caja' })
  createMovement(@Req() req: Request, @Body() dto: CreateCashMovementDto) {
    return this.cashService.createMovement(req.user as any, dto);
  }

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Get('current')
  @ApiOperation({ summary: 'Obtener caja abierta actual' })
  getCurrent(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.cashService.getCurrentRegister(req.user as any, branchId);
  }
}
