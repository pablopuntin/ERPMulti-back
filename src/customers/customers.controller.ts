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
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('Customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

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
