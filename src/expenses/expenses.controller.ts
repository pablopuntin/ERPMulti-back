import {
  Controller,
  Post,
  Get,
  Body,
  Delete,
  Param,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';
import { CreateVariableExpenseDto } from './dto/create-variable-expense.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@ApiTags('Expenses')
@UseGuards(AuthGuard('jwt'))
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('fixed')
  @ApiOperation({ summary: 'Registrar un gasto fijo' })
  createFixed(
    @Req() req: Request,
    @Body() dto: CreateFixedExpenseDto,
    @Body('branchId') branchId?: string
  ) {
    return this.expensesService.createFixed(req.user as any, dto, branchId);
  }

  @Post('variable')
  @ApiOperation({ summary: 'Registrar un gasto variable' })
  createVariable(
    @Req() req: Request,
    @Body() dto: CreateVariableExpenseDto,
    @Body('branchId') branchId?: string
  ) {
    return this.expensesService.createVariable(req.user as any, dto, branchId);
  }

  @Get('fixed')
  @ApiOperation({ summary: 'Listar gastos fijos' })
  findAllFixed(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.expensesService.findAllFixed(req.user as any, branchId);
  }

  @Get('variable')
  @ApiOperation({ summary: 'Listar gastos variables' })
  findAllVariable(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.expensesService.findAllVariable(req.user as any, branchId);
  }

  @Delete('fixed/:id')
  @ApiOperation({ summary: 'Eliminar gasto fijo' })
  removeFixed(@Req() req: Request, @Param('id') id: string) {
    return this.expensesService.removeFixed(req.user as any, id);
  }

  @Delete('variable/:id')
  @ApiOperation({ summary: 'Eliminar gasto variable' })
  removeVariable(@Req() req: Request, @Param('id') id: string) {
    return this.expensesService.removeVariable(req.user as any, id);
  }
}
