import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CreateAccountAdjustmentDto } from './dto/create-account-adjustment.dto';
import { CreateAccountEntryDto } from './dto/create-account-entry.dto';
import { ListAccountEntriesDto } from './dto/list-account-entries.dto';
import { AccountAdjustmentsService } from './services/account-adjustments.service';
import { AccountLedgerService } from './services/account-ledger.service';
import { AccountStatementService } from './services/account-statement.service';

@ApiTags('Account')
@UseGuards(AuthGuard('jwt'))
@Controller('account')
export class AccountController {
  constructor(
    private readonly accountLedgerService: AccountLedgerService,
    private readonly accountAdjustmentsService: AccountAdjustmentsService,
    private readonly accountStatementService: AccountStatementService
  ) {}

  @Get('entries')
  @ApiOperation({ summary: 'Listar movimientos de cuenta corriente' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findEntries(@Req() req: Request, @Query() filters: ListAccountEntriesDto) {
    return this.accountLedgerService.findAll(req.user as any, filters);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: 'Obtener un movimiento de cuenta corriente' })
  findEntry(@Req() req: Request, @Param('id') id: string) {
    return this.accountLedgerService.findOne(req.user as any, id);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Crear movimiento de cuenta corriente' })
  createEntry(@Req() req: Request, @Body() dto: CreateAccountEntryDto) {
    return this.accountLedgerService.create(req.user as any, dto);
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Crear ajuste manual de cuenta corriente' })
  createAdjustment(@Req() req: Request, @Body() dto: CreateAccountAdjustmentDto) {
    return this.accountAdjustmentsService.create(req.user as any, dto);
  }

  @Get('customers/:customerId/statement')
  @ApiOperation({ summary: 'Obtener estado de cuenta de un cliente' })
  @ApiQuery({ name: 'branchId', required: false })
  getCustomerStatement(
    @Req() req: Request,
    @Param('customerId') customerId: string,
    @Query('branchId') branchId?: string
  ) {
    return this.accountStatementService.getCustomerStatement(
      req.user as any,
      customerId,
      branchId
    );
  }
}
