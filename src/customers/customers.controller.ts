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
import { CustomerCreditService } from 'src/customer-credit/customer-credit.service';
import { ApplyCustomerCreditPaymentDto } from 'src/customer-credit/dto/apply-customer-credit-payment.dto';
import { ApplyCustomerCreditAdjustmentDto } from 'src/customer-credit/dto/apply-customer-credit-adjustment.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('Customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customerCreditService: CustomerCreditService
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
  getCreditSummary(@Req() req: Request, @Param('id') id: string) {
    return this.customerCreditService.getCustomerSummary(id, req.user as any);
  }

  @Get(':id/credit-documents')
  @ApiOperation({
    summary: 'Listar comprobantes de cuenta corriente del cliente'
  })
  getCreditDocuments(@Req() req: Request, @Param('id') id: string) {
    return this.customerCreditService.getCustomerDocuments(id, req.user as any);
  }

  @Get(':id/credit-movements')
  @ApiOperation({
    summary: 'Listar movimientos de cuenta corriente del cliente'
  })
  getCreditMovements(@Req() req: Request, @Param('id') id: string) {
    return this.customerCreditService.getCustomerMovements(id, req.user as any);
  }

  @Post(':id/credit-payments/apply')
  @ApiOperation({
    summary:
      'Registrar cobro posterior de cuenta corriente por importe o por remitos'
  })
  applyCreditPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApplyCustomerCreditPaymentDto
  ) {
    return this.customerCreditService.applyCustomerPayment(
      req.user as any,
      id,
      dto
    );
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
    @Body() dto: ApplyCustomerCreditAdjustmentDto
  ) {
    return this.customerCreditService.applyDocumentAdjustment(
      req.user as any,
      id,
      dto
    );
  }

  @Get(':id/credit-receipts/:receiptId/pdf')
  @ApiOperation({
    summary: 'Generar PDF de recibo de cobro de cuenta corriente'
  })
  async getCreditReceiptPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('receiptId') receiptId: string
  ) {
    const pdfBuffer =
      await this.customerCreditService.generateCustomerReceiptPdf(
        id,
        receiptId,
        req.user as any
      );
    return {
      receiptId,
      pdfBase64: pdfBuffer.toString('base64'),
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
