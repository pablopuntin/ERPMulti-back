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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { Request } from 'express';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Post()
  create(@Req() req: Request, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(req.user as any, dto);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Get()
  findAll(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.paymentsService.findAll(req.user as any, branchId);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.paymentsService.findOne(req.user as any, id);
  }

  @Roles('root', 'gerente_general')
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePaymentDto>
  ) {
    return this.paymentsService.update(req.user as any, id, dto);
  }

  @Roles('root', 'gerente_general')
  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto?: ReversePaymentDto
  ) {
    return this.paymentsService.remove(req.user as any, id, dto);
  }
}
