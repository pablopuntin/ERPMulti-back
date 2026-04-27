import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
  Query
} from '@nestjs/common';
import { AuthSwagger } from 'src/auth/decorators/auth-swagger.decorator';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProductBaseSimpleDto } from './dto/create-product-base-simple.dto';
import { UpdateProductsBaseDto } from './dto/update-products-base.dto';
import { AddVariantWithStocksDto } from './dto/add-variant-with-stocks.dto';
import { PreviewProductsImportDto } from './dto/preview-products-import.dto';
import { ProductsBaseService } from './products-base.service';
import type { Request } from 'express';

type UploadedExcelFile = {
  originalname?: string;
  buffer: Buffer;
};

@Controller('products-base')
export class ProductsBaseController {
  constructor(private readonly productsBaseService: ProductsBaseService) {}

  @ApiOperation({ summary: 'Mostrar todos los productos' })
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  findAll(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.productsBaseService.findAll(req.user as any, false, branchId);
  }

  @ApiOperation({ summary: 'Mostrar productos por id' })
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsBaseService.findOne(id);
  }

  @ApiOperation({ summary: 'Crear producto simple (solo ProductBase)' })
  @Post('create-simple')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  createSimple(@Body() createProductBaseSimpleDto: CreateProductBaseSimpleDto) {
    return this.productsBaseService.createSimple(createProductBaseSimpleDto);
  }

  @ApiOperation({ summary: 'Preview de importación masiva de productos' })
  @Post('import/preview')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general')
  previewImport(@Req() req: Request, @Body() previewProductsImportDto: PreviewProductsImportDto) {
    return this.productsBaseService.previewImport(req.user as any, previewProductsImportDto);
  }

  @ApiOperation({
    summary: 'Preview de importación masiva de productos desde Excel'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary'
        }
      },
      required: ['file']
    }
  })
  @Post('import/preview-file')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general')
  @UseInterceptors(FileInterceptor('file'))
  previewImportFile(@Req() req: Request, @UploadedFile() file: UploadedExcelFile) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo Excel');
    }

    const fileName = file.originalname?.toLowerCase() || '';
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      throw new BadRequestException('El archivo debe ser .xlsx o .xls');
    }

    return this.productsBaseService.previewImportFile(req.user as any, file.buffer);
  }

  @ApiOperation({ summary: 'Importación masiva de productos' })
  @Post('import')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general')
  importProducts(@Req() req: Request, @Body() previewProductsImportDto: PreviewProductsImportDto) {
    return this.productsBaseService.importProducts(req.user as any, previewProductsImportDto);
  }

  @ApiOperation({ summary: 'Importación masiva de productos desde Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary'
        }
      },
      required: ['file']
    }
  })
  @Post('import/file')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general')
  @UseInterceptors(FileInterceptor('file'))
  importProductsFile(@Req() req: Request, @UploadedFile() file: UploadedExcelFile) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo Excel');
    }

    const fileName = file.originalname?.toLowerCase() || '';
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      throw new BadRequestException('El archivo debe ser .xlsx o .xls');
    }

    return this.productsBaseService.importProductsFile(req.user as any, file.buffer);
  }

  @ApiOperation({
    summary: 'Agregar variante con múltiples stocks a ProductBase existente'
  })
  @Post(':id/add-variant-with-stocks')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  addVariantWithStocks(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addVariantWithStocksDto: AddVariantWithStocksDto
  ) {
    return this.productsBaseService.addVariantWithStocks(
      req.user as any,
      id,
      addVariantWithStocksDto
    );
  }

  @ApiOperation({
    summary: 'Agregar variante a ProductBase existente (legacy)'
  })
  @Post(':id/add-variant')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  addVariant(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    variantData: {
      name: string;
      price: number;
      stock: number;
      sku?: string;
      minStock?: number;
      branchId?: string;
    }
  ) {
    return this.productsBaseService.addVariantToProductBase(req.user as any, id, variantData);
  }

  @ApiOperation({ summary: 'Modificar productos' })
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductsBaseDto: UpdateProductsBaseDto
  ) {
    return this.productsBaseService.update(id, updateProductsBaseDto);
  }

  @ApiOperation({ summary: 'Desactivar un producto base (borrado lógico)' })
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsBaseService.deactivate(id);
  }

  @ApiOperation({ summary: 'Obtener variantes de un producto base' })
  @Get(':id/variants')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  findVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsBaseService.findVariantsByProductBase(id);
  }

  @ApiOperation({ summary: 'Obtener stock detallado de una variante' })
  @Get('variants/:variantId/stock-details')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  getStockDetails(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsBaseService.checkLowStock(variantId);
  }

  @ApiOperation({ summary: 'Obtener stock total de una variante' })
  @Get('variants/:variantId/stock-total')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  async getTotalStock(@Param('variantId', ParseUUIDPipe) variantId: string) {
    const total = await this.productsBaseService.calculateTotalStock(variantId);
    return { variantId, totalStock: total };
  }

  @ApiOperation({ summary: 'Eliminar una variante de producto' })
  @Delete('variants/:variantId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal')
  async removeVariant(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.productsBaseService.removeVariant(variantId);
  }
}
