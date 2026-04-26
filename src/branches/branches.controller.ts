import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Req
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthSwagger } from 'src/auth/decorators/auth-swagger.decorator';
import { UpdateBranchSalesSettingsDto } from './dto/update-branch-sales-settings.dto';

@ApiTags('branches')
@AuthSwagger()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Roles('root', 'gerente_general')
  @ApiOperation({ summary: 'Crear una nueva sucursal' })
  @Post()
  create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchesService.create(createBranchDto);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero', 'vendedor')
  @ApiOperation({ summary: 'Obtener todas las sucursales activas' })
  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero', 'vendedor')
  @ApiOperation({ summary: 'Obtener una sucursal por ID' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.findOne(id);
  }

  @Roles('root', 'gerente_general')
  @ApiOperation({ summary: 'Actualizar una sucursal' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBranchDto: Partial<CreateBranchDto>
  ) {
    return this.branchesService.update(id, updateBranchDto);
  }

  @Roles('root', 'gerente_general')
  @ApiOperation({ summary: 'Desactivar una sucursal (borrado lógico)' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.remove(id);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero', 'vendedor')
  @ApiOperation({ summary: 'Obtener stock de una sucursal' })
  @Get(':id/stock')
  getStockByBranch(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.getStockByBranch(id);
  }

  @Roles('root', 'gerente_general', 'gerente_sucursal', 'cajero', 'vendedor')
  @ApiOperation({ summary: 'Obtener items con stock bajo en una sucursal' })
  @Get(':id/low-stock')
  getLowStockItems(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.getLowStockItems(id);
  }

  @Roles('root', 'gerente_general')
  @ApiOperation({
    summary:
      'Obtener la configuración de ventas estrictas por stock de una sucursal'
  })
  @Get(':id/sales-settings')
  getSalesSettings(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.getSalesSettings(id);
  }

  @Roles('root', 'gerente_general')
  @ApiOperation({
    summary:
      'Actualizar la configuración de ventas estrictas por stock de una sucursal'
  })
  @Patch(':id/sales-settings')
  updateSalesSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchSalesSettingsDto
  ) {
    return this.branchesService.updateSalesSettings(id, dto);
  }
}
