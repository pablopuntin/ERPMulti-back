import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductsVariantsService } from './products-variants.service';
import { CreateProductVariantDto } from './dto/create-products-variant.dto';
import { BulkUpdatePricesDto } from './dto/bulk-update-prices.dto';
import { BulkUpdateStockDto } from './dto/bulk-update-stock.dto';
import { ListProductVariantsDto } from './dto/list-product-variants.dto';
import { UpdateProductsVariantDto } from './dto/update-products-variant.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Product Variants')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero', 'vendedor')
@Controller('product-variants')
export class ProductsVariantsController {
  constructor(private readonly variantsService: ProductsVariantsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva variante de producto' })
  create(@Body() dto: CreateProductVariantDto) {
    return this.variantsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las variantes de productos' })
  findAll() {
    return this.variantsService.findAll();
  }

  @Get('catalog')
  @ApiOperation({
    summary: 'Listar variantes de productos de forma paginada para catálogo'
  })
  findCatalog(@Query() query: ListProductVariantsDto) {
    return this.variantsService.findCatalog(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una variante por ID' })
  findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }

  @Get(':id/stock-by-branch')
  @ApiOperation({ summary: 'Obtener stock por sucursal para una variante' })
  getStockByBranch(@Param('id') id: string) {
    return this.variantsService.getStockByBranch(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una variante' })
  update(@Param('id') id: string, @Body() dto: UpdateProductsVariantDto) {
    return this.variantsService.update(id, dto);
  }

  @Post('bulk-update-prices')
  @ApiOperation({ summary: 'Actualizar precios masivamente' })
  bulkUpdatePrices(@Body() dto: BulkUpdatePricesDto) {
    return this.variantsService.bulkUpdatePrices(dto);
  }

  @Post('bulk-update-stock')
  @ApiOperation({ summary: 'Actualizar stock masivamente por ubicación' })
  bulkUpdateStock(@Body() dto: BulkUpdateStockDto) {
    return this.variantsService.bulkUpdateStock(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una variante (borrado lógico)' })
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }
}
