import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseUUIDPipe
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { AuthSwagger } from 'src/auth/decorators/auth-swagger.decorator';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor')
  @Post()
  @ApiOperation({ summary: 'Crear una marca' })
  @ApiBody({ type: CreateBrandDto })
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.createBrand(dto);
  }

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  @Get()
  @ApiOperation({ summary: 'Obtener todas las marcas' })
  findAll() {
    return this.brandsService.findAll();
  }

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una marca por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la marca' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.findOne(id);
  }

  //endpoint para obtener productosbase asociados a brand
  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root', 'gerente_general', 'gerente_sucursal', 'vendedor', 'cajero')
  @Get(':id/products-base')
  @ApiOperation({ summary: 'Obtener productsBase de una marca' })
  findProductsBase(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.findProductsBaseByBrand(id);
  }
}
