import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SalesReportFiltersDto {
  @ApiPropertyOptional({ description: 'ID de categoría para filtrar' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'ID de marca para filtrar' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'ID de producto específico para filtrar'
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre de producto o SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Fecha inicial (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha final (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'ID de sucursal específica. Solo para usuarios con alcance global'
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Comparar entre sucursales. Solo para usuarios con alcance global',
    default: false
  })
  @IsOptional()
  compareBranches?: boolean;
}

export interface SalesByProductItem {
  productId: string;
  productName: string;
  productSku: string;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  totalUnits: number;
  totalRevenue: number;
  averagePrice: number;
  lastCostPrice?: number;
  totalCost?: number;
  marginAmount?: number;
  marginPercentage?: number;
  ordersCount: number;
  branchId?: string;
  branchName?: string;
}

export interface SalesByCategoryItem {
  categoryId: string;
  categoryName: string;
  totalUnits: number;
  totalRevenue: number;
  averagePrice: number;
  ordersCount: number;
  branchId?: string;
  branchName?: string;
}

export interface SalesByBrandItem {
  brandId: string;
  brandName: string;
  totalUnits: number;
  totalRevenue: number;
  averagePrice: number;
  ordersCount: number;
  branchId?: string;
  branchName?: string;
}
