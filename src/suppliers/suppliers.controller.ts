import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // === SUPPLIERS ===

  @Post()
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(dto);
  }

  @Get()
  findAllSuppliers() {
    return this.suppliersService.findAllSuppliers();
  }

  @Get(':id')
  findOneSupplier(@Param('id') id: string) {
    return this.suppliersService.findOneSupplier(id);
  }

  @Patch(':id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.updateSupplier(id, dto);
  }

  @Delete(':id')
  removeSupplier(@Param('id') id: string) {
    return this.suppliersService.removeSupplier(id);
  }

  // === SUPPLIER PRODUCTS ===

  @Post('products')
  addProductToSupplier(@Body() dto: CreateSupplierProductDto) {
    return this.suppliersService.addProductToSupplier(dto);
  }

  @Patch('products/:id')
  updateSupplierProduct(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierProductDto
  ) {
    return this.suppliersService.updateSupplierProduct(id, dto);
  }

  @Delete('products/:id')
  removeSupplierProduct(@Param('id') id: string) {
    return this.suppliersService.removeSupplierProduct(id);
  }
}
