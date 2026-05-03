import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ApplyAccountPaymentDto } from 'src/account/dto/apply-account-payment.dto';
import { CreateAccountAdjustmentDto } from 'src/account/dto/create-account-adjustment.dto';
import {
  AccountEntryDirection,
  AccountEntrySourceModule,
  AccountEntryType
} from 'src/account/entities/account-entry.entity';
import { AccountAdjustmentsService } from 'src/account/services/account-adjustments.service';
import { AccountLedgerService } from 'src/account/services/account-ledger.service';
import { AccountStatementService } from 'src/account/services/account-statement.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('Customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly accountLedgerService: AccountLedgerService,
    private readonly accountAdjustmentsService: AccountAdjustmentsService,
    private readonly accountStatementService: AccountStatementService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear cliente interno' })
  create(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user as any, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes internos' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string
  ) {
    return this.customersService.findAll(req.user as any, branchId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente interno por ID' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.customersService.findOne(req.user as any, id);
  }

  @Get(':id/credit-summary')
  @ApiOperation({ summary: 'Obtener resumen de cuenta corriente del cliente' })
  getCreditSummary(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('branchId') branchId?: string
  ) {
    return this.accountStatementService.getLegacyCustomerSummary(
      req.user as any,
      id,
      branchId
    );
  }

  @Get(':id/credit-documents')
  @ApiOperation({
    summary: 'Listar comprobantes de cuenta corriente del cliente'
  })
  getCreditDocuments(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('branchId') branchId?: string
  ) {
    return this.accountLedgerService.findAll(req.user as any, {
      customerId: id,
      branchId
    });
  }

  @Get(':id/credit-movements')
  @ApiOperation({
    summary: 'Listar movimientos de cuenta corriente del cliente'
  })
  getCreditMovements(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('branchId') branchId?: string
  ) {
    return this.accountLedgerService.findAll(req.user as any, {
      customerId: id,
      branchId
    });
  }

  @Post(':id/credit-payments/apply')
  @ApiOperation({
    summary:
      'Registrar cobro posterior de cuenta corriente por importe o por remitos'
  })
  applyCreditPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApplyAccountPaymentDto
  ) {
    return this.accountLedgerService.create(req.user as any, {
      customerId: id,
      entryType: AccountEntryType.PAYMENT,
      entryDirection: AccountEntryDirection.CREDIT,
      amount: Number(dto.amount || 0),
      sourceModule: AccountEntrySourceModule.PAYMENTS,
      sourceEntityType: 'customer_account_payment',
      sourceEntityId: `${id}:${Date.now()}`,
      cashierUserId: dto.paidByUserId,
      reasonCode: 'customer_account_payment',
      reasonText: 'Cobro posterior de cuenta corriente',
      notes: dto.notes
    });
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero')
  @Post(':id/credit-adjustments')
  @ApiOperation({
    summary:
      'Registrar nota de crédito o débito sobre un comprobante de cuenta corriente'
  })
  applyCreditAdjustment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateAccountAdjustmentDto
  ) {
    return this.accountAdjustmentsService.create(req.user as any, {
      ...dto,
      customerId: id
    });
  }

  @Get(':id/credit-receipts/:receiptId/pdf')
  @ApiOperation({
    summary: 'Generar PDF de recibo de cobro de cuenta corriente'
  })
  async getCreditReceiptPdf(@Param('receiptId') receiptId: string) {
    return {
      receiptId,
      pdfBase64: '',
      pdfFileName: `recibo-cc-${receiptId}.pdf`
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cliente interno' })
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(req.user as any, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Baja lógica de cliente interno' })
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.customersService.remove(req.user as any, id);
  }
}
