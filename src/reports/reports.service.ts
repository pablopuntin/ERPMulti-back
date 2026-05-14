// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Between, Repository } from 'typeorm';
// import {
//   CashMovement,
//   CashMovementType
// } from 'src/cash/entities/cash-movement.entity';
// import { CashRegister } from 'src/cash/entities/cash-register.entity';
// import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
// import { PriceChangeHistory } from 'src/price-history/entities/price-history.entity';
// import { Order } from 'src/orders/entities/order.entity';
// import { OrderItem } from 'src/orders/entities/order-item.entity';
// import { PurchaseItem } from 'src/purchase/entities/purchase-item.entity';
// import { Category } from 'src/categories/entities/category.entity';
// import { Brand } from 'src/brands/entities/brand.entity';
// import { Branch } from 'src/branches/entities/branch.entity';
// import { ILike } from 'typeorm';
// import { ProductsBaseService } from 'src/products-base/products-base.service';
// import {
//   BranchScopedUser,
//   resolveBranchScope
// } from 'src/common/auth/branch-scope.util';

// type ReportAccessUser = BranchScopedUser;

// const parseReportDate = (value?: string, fallback?: Date) => {
//   if (!value) {
//     return fallback ? new Date(fallback) : new Date();
//   }

//   const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
//   if (isoDateMatch) {
//     const [, year, month, day] = isoDateMatch;
//     return new Date(Number(year), Number(month) - 1, Number(day));
//   }

//   return new Date(value);
// };

// @Injectable()
// export class ReportsService {
//   constructor(
//     @InjectRepository(CashMovement)
//     private readonly movementRepo: Repository<CashMovement>,

//     @InjectRepository(CashRegister)
//     private readonly registerRepo: Repository<CashRegister>,

//     @InjectRepository(ProductVariant)
//     private readonly variantRepo: Repository<ProductVariant>,

//     @InjectRepository(PriceChangeHistory)
//     private readonly priceHistoryRepo: Repository<PriceChangeHistory>,

//     @InjectRepository(Order)
//     private readonly orderRepo: Repository<Order>,

//     @InjectRepository(OrderItem)
//     private readonly orderItemRepo: Repository<OrderItem>,

//     @InjectRepository(PurchaseItem)
//     private readonly purchaseItemRepo: Repository<PurchaseItem>,

//     @InjectRepository(Category)
//     private readonly categoryRepo: Repository<Category>,

//     @InjectRepository(Brand)
//     private readonly brandRepo: Repository<Brand>,

//     @InjectRepository(Branch)
//     private readonly branchRepo: Repository<Branch>,

//     private readonly productsBaseService: ProductsBaseService
//   ) {}

//   // ─────────────────────────────────────────────────────────────
//   //  📈 1. REPORTE DE INGRESOS / EGRESOS / BALANCE
//   // ─────────────────────────────────────────────────────────────
//   async getFinanceReport(
//     user: ReportAccessUser,
//     from?: string,
//     to?: string,
//     branchId?: string
//   ) {
//     // Defaults al año actual
//     const currentYear = new Date().getFullYear();

//     const fromDate = parseReportDate(from, new Date(currentYear, 0, 1));
//     const toDate = parseReportDate(to, new Date(currentYear, 11, 31));
//     fromDate.setHours(0, 0, 0, 0);
//     toDate.setHours(23, 59, 59, 999);
//     const resolvedBranchId = resolveBranchScope(user, {
//       requestedBranchId: branchId,
//       allowGlobal: true,
//       globalPermissions: ['view_reports'],
//       requireActiveBranch: false,
//       forbiddenMessage:
//         'No tienes acceso a la sucursal solicitada para reportes'
//     });

//     const totals = await this.movementRepo
//       .createQueryBuilder('m')
//       .innerJoin('m.register', 'register')
//       .andWhere('m.createdAt BETWEEN :from AND :to', {
//         from: fromDate,
//         to: toDate
//       })
//       .andWhere(
//         resolvedBranchId ? 'register.branchId = :branchId' : '1=1',
//         resolvedBranchId ? { branchId: resolvedBranchId } : {}
//       )
//       .select(
//         `COALESCE(SUM(CASE WHEN m.type = :incomeType THEN m.amount ELSE 0 END), 0)`,
//         'totalIncome'
//       )
//       .addSelect(
//         `COALESCE(SUM(CASE WHEN m.type = :expenseType THEN m.amount ELSE 0 END), 0)`,
//         'totalExpense'
//       )
//       .setParameters({
//         incomeType: CashMovementType.INCOME,
//         expenseType: CashMovementType.EXPENSE
//       })
//       .getRawOne();

//     const totalIncome = Number(totals?.totalIncome || 0);
//     const totalExpense = Number(totals?.totalExpense || 0);
//     const balance = totalIncome - totalExpense;

//     return {
//       from: fromDate,
//       to: toDate,
//       branchId: resolvedBranchId,
//       totalIncome,
//       totalExpense,
//       balance
//     };
//   }

//   // ─────────────────────────────────────────────────────────────
//   //  📜 2. DETALLES DE LOS MOVIMIENTOS (INGRESOS/EGRESOS)
//   // ─────────────────────────────────────────────────────────────
//   async getCashMovements(
//     user: ReportAccessUser,
//     type?: CashMovementType,
//     from?: string,
//     to?: string,
//     branchId?: string
//   ) {
//     const resolvedBranchId = resolveBranchScope(user, {
//       requestedBranchId: branchId,
//       allowGlobal: true,
//       globalPermissions: ['view_reports'],
//       requireActiveBranch: false,
//       forbiddenMessage:
//         'No tienes acceso a la sucursal solicitada para reportes'
//     });
//     const query = this.movementRepo
//       .createQueryBuilder('m')
//       .leftJoinAndSelect('m.register', 'register')
//       .orderBy('m.createdAt', 'DESC');

//     if (type) {
//       query.andWhere('m.type = :type', { type });
//     }

//     if (from) {
//       const fromDate = parseReportDate(from);
//       fromDate.setHours(0, 0, 0, 0);
//       query.andWhere('m.createdAt >= :from', { from: fromDate });
//     }

//     if (to) {
//       const toDate = parseReportDate(to);
//       toDate.setHours(23, 59, 59, 999);
//       query.andWhere('m.createdAt <= :to', { to: toDate });
//     }

//     if (resolvedBranchId) {
//       query.andWhere('register.branchId = :branchId', {
//         branchId: resolvedBranchId
//       });
//     }

//     const movements = await query.getMany();

//     const extractOrderReference = (reason?: string) => {
//       const normalizedReason = String(reason || '');
//       const remitoMatch = normalizedReason.match(
//         /Pago\s+([^\s]+)\s+-\s+Remito\s+([^\s]+)/i
//       );
//       if (remitoMatch) {
//         return {
//           paymentMethod: remitoMatch[1]?.toLowerCase() || 'cash',
//           remitoNumber: remitoMatch[2]
//         };
//       }

//       const legacyOrderMatch = normalizedReason.match(
//         /Pago\s+([^\s]+)\s+-\s+Orden\s+([a-f0-9-]{36})/i
//       );
//       if (legacyOrderMatch) {
//         return {
//           paymentMethod: legacyOrderMatch[1]?.toLowerCase() || 'cash',
//           orderId: legacyOrderMatch[2]
//         };
//       }

//       return {
//         paymentMethod: 'cash'
//       };
//     };

//     const paymentMovementOrderIds = Array.from(
//       new Set(
//         movements
//           .map(
//             (movement) => extractOrderReference(movement.reason).orderId || null
//           )
//           .filter(Boolean)
//       )
//     );

//     const paymentMovementRemitos = Array.from(
//       new Set(
//         movements
//           .map(
//             (movement) =>
//               extractOrderReference(movement.reason).remitoNumber || null
//           )
//           .filter(Boolean)
//       )
//     );

//     const relatedOrdersById =
//       paymentMovementOrderIds.length > 0
//         ? await this.orderRepo.find({
//             where: paymentMovementOrderIds.map((id) => ({ id: id as string })),
//             relations: ['user', 'customer']
//           })
//         : [];

//     const relatedOrdersByRemito =
//       paymentMovementRemitos.length > 0
//         ? await this.orderRepo.find({
//             where: paymentMovementRemitos.map((remitoNumber) => ({
//               remitoNumber: remitoNumber as string
//             })),
//             relations: ['user', 'customer']
//           })
//         : [];

//     const orderMap = new Map(
//       relatedOrdersById.map((order) => [order.id, order])
//     );
//     const remitoMap = new Map(
//       relatedOrdersByRemito.map((order) => [order.remitoNumber, order])
//     );

//     return movements.map((movement) => {
//       const { paymentMethod, orderId, remitoNumber } = extractOrderReference(
//         movement.reason
//       );
//       const relatedOrder = orderId
//         ? orderMap.get(orderId)
//         : remitoNumber
//           ? remitoMap.get(remitoNumber)
//           : undefined;
//       const sellerName = relatedOrder
//         ? [relatedOrder.user?.firstname, relatedOrder.user?.lastname]
//             .filter(Boolean)
//             .join(' ') || 'Sin vendedor'
//         : undefined;
//       const customerName =
//         relatedOrder?.customerNameSnapshot ||
//         relatedOrder?.customer?.fullName ||
//         undefined;
//       const shortOrderId = orderId
//         ? orderId.slice(0, 8).toUpperCase()
//         : undefined;
//       const resolvedReference =
//         relatedOrder?.remitoNumber ||
//         remitoNumber ||
//         shortOrderId ||
//         movement.register?.id;

//       const description = relatedOrder
//         ? `Cobro remito ${relatedOrder.remitoNumber || shortOrderId}${customerName ? ` · ${customerName}` : ''}${sellerName ? ` · Vendió ${sellerName}` : ''}`
//         : movement.reason || 'Movimiento de caja';

//       return {
//         ...movement,
//         paymentMethod,
//         orderId,
//         remitoNumber: relatedOrder?.remitoNumber || remitoNumber,
//         sellerName,
//         customerName,
//         description,
//         referenceLabel: resolvedReference
//       };
//     });
//   }

//   // ─────────────────────────────────────────────────────────────
//   //  🧮 3. RESUMEN DE RENTABILIDAD (VENTAS - COMPRAS)
//   // ─────────────────────────────────────────────────────────────
//   async getProfit(
//     user: ReportAccessUser,
//     from?: string,
//     to?: string,
//     branchId?: string
//   ) {
//     return this.getFinanceReport(user, from, to, branchId); // mismo default
//   }

//   // ─────────────────────────────────────────────────────────────
//   //  🗓 4. RESUMEN DIARIO DE CAJA
//   // ─────────────────────────────────────────────────────────────
//   async getDailySummary(
//     user: ReportAccessUser,
//     date?: string,
//     branchId?: string
//   ) {
//     const target = parseReportDate(date);

//     const start = new Date(target);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(target);
//     end.setHours(23, 59, 59, 999);

//     return this.getFinanceReport(
//       user,
//       start.toISOString(),
//       end.toISOString(),
//       branchId
//     );
//   }

//   // ─────────────────────────────────────────────────────────────
//   //  🔍 5. REPORTE DE CAMBIOS DE PRECIO (ya lo tenías)
//   // ─────────────────────────────────────────────────────────────
//   async getPriceChanges({ from, to }: { from?: string; to?: string }) {
//     const where =
//       from && to ? { changedAt: Between(new Date(from), new Date(to)) } : {};
//     return this.priceHistoryRepo.find({ where, order: { changedAt: 'DESC' } });
//   }

//   // ─────────────────────────────────────────────────────────────
//   //  📦 6. REPORTE DE STOCK (ya mejorado)
//   // ─────────────────────────────────────────────────────────────
//   // //////////////////////////////////////////////////////////////////////////////////////
//   // 4. VENTAS POR PRODUCTOS (con márgenes)
//   // //////////////////////////////////////////////////////////////////////////////////////
//   async getSalesByProducts(user: ReportAccessUser, filters: any = {}) {
//     const resolvedBranchId = resolveBranchScope(user, {
//       requestedBranchId: filters.branchId,
//       allowGlobal: true,
//       globalPermissions: ['view_reports'],
//       requireActiveBranch: false,
//       forbiddenMessage:
//         'No tienes acceso a la sucursal solicitada para reportes'
//     });

//     const fromDate = filters.from
//       ? parseReportDate(filters.from)
//       : new Date(new Date().getFullYear(), 0, 1);
//     const toDate = filters.to ? parseReportDate(filters.to) : new Date();

//     fromDate.setHours(0, 0, 0, 0);
//     toDate.setHours(23, 59, 59, 999);

//     // Base query para ventas
//     const query = this.orderItemRepo
//       .createQueryBuilder('oi')
//       .leftJoin('oi.order', 'o')
//       .leftJoin('oi.variant', 'pv')
//       .leftJoin('pv.productBase', 'pb')
//       .leftJoin('pv.category', 'c')
//       .leftJoin('pv.brand', 'b')
//       .leftJoin('o.branch', 'branch')
//       .where('o.status IN (:...statuses)', {
//         statuses: ['approved', 'completed']
//       })
//       .andWhere('o.createdAt BETWEEN :from AND :to', {
//         from: fromDate,
//         to: toDate
//       })
//       .andWhere('oi.approvedQuantity > 0');

//     if (resolvedBranchId) {
//       query.andWhere('o.branchId = :branchId', { branchId: resolvedBranchId });
//     }

//     if (filters.categoryId) {
//       query.andWhere('c.id = :categoryId', { categoryId: filters.categoryId });
//     }

//     if (filters.brandId) {
//       query.andWhere('b.id = :brandId', { brandId: filters.brandId });
//     }

//     if (filters.productId) {
//       query.andWhere('pb.id = :productId', { productId: filters.productId });
//     }

//     if (filters.search) {
//       query.andWhere(
//         '(pv.name ILIKE :search OR pv.sku ILIKE :search OR pb.name ILIKE :search)',
//         {
//           search: `%${filters.search}%`
//         }
//       );
//     }

//     const sales = await query
//       .select('pv.id', 'productId')
//       .addSelect('COALESCE(pb.name, pv.name)', 'productName')
//       .addSelect('pv.sku', 'productSku')
//       .addSelect('c.id', 'categoryId')
//       .addSelect('c.name', 'categoryName')
//       .addSelect('b.id', 'brandId')
//       .addSelect('b.name', 'brandName')
//       .addSelect('SUM(oi.approvedQuantity)', 'totalUnits')
//       .addSelect('SUM(oi.subtotal)', 'totalRevenue')
//       .addSelect('AVG(oi.price)', 'averagePrice')
//       .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
//       .addSelect('o.branchId', 'branchId')
//       .addSelect('branch.name', 'branchName')
//       .groupBy('pv.id, c.id, b.id, o.branchId, branch.id')
//       .addGroupBy('pb.name')
//       .addGroupBy('pv.name')
//       .addGroupBy('pv.sku')
//       .addGroupBy('c.name')
//       .addGroupBy('b.name')
//       .addOrderBy('SUM(oi.subtotal)', 'DESC')
//       .getRawMany();

//     return sales.map((sale) => {
//       return {
//         productId: sale.productId,
//         productName: sale.productName,
//         productSku: sale.productSku,
//         categoryId: sale.categoryId,
//         categoryName: sale.categoryName,
//         brandId: sale.brandId,
//         brandName: sale.brandName,
//         totalUnits: Number(sale.totalUnits) || 0,
//         totalRevenue: Number(sale.totalRevenue) || 0,
//         averagePrice: Number(sale.averagePrice) || 0,
//         lastCostPrice: undefined,
//         totalCost: undefined,
//         marginAmount: undefined,
//         marginPercentage: undefined,
//         ordersCount: Number(sale.ordersCount) || 0,
//         branchId: sale.branchId,
//         branchName: sale.branchName
//       };
//     });
//   }

//   // //////////////////////////////////////////////////////////////////////////////////////
//   // 5. VENTAS POR CATEGORÍAS
//   // //////////////////////////////////////////////////////////////////////////////////////
//   async getSalesByCategories(user: ReportAccessUser, filters: any = {}) {
//     const resolvedBranchId = resolveBranchScope(user, {
//       requestedBranchId: filters.branchId,
//       allowGlobal: true,
//       globalPermissions: ['view_reports'],
//       requireActiveBranch: false,
//       forbiddenMessage:
//         'No tienes acceso a la sucursal solicitada para reportes'
//     });

//     const fromDate = filters.from
//       ? parseReportDate(filters.from)
//       : new Date(new Date().getFullYear(), 0, 1);
//     const toDate = filters.to ? parseReportDate(filters.to) : new Date();

//     fromDate.setHours(0, 0, 0, 0);
//     toDate.setHours(23, 59, 59, 999);

//     const query = this.orderItemRepo
//       .createQueryBuilder('oi')
//       .leftJoin('oi.order', 'o')
//       .leftJoin('oi.variant', 'pv')
//       .leftJoin('pv.category', 'c')
//       .leftJoin('o.branch', 'branch')
//       .where('o.status IN (:...statuses)', {
//         statuses: ['approved', 'completed']
//       })
//       .andWhere('o.createdAt BETWEEN :from AND :to', {
//         from: fromDate,
//         to: toDate
//       })
//       .andWhere('oi.approvedQuantity > 0')
//       .andWhere('c.id IS NOT NULL');

//     if (resolvedBranchId) {
//       query.andWhere('o.branchId = :branchId', { branchId: resolvedBranchId });
//     }

//     if (filters.search) {
//       query.andWhere('c.name ILIKE :search', { search: `%${filters.search}%` });
//     }

//     return await query
//       .select('c.id', 'categoryId')
//       .addSelect('c.name', 'categoryName')
//       .addSelect('SUM(oi.approvedQuantity)', 'totalUnits')
//       .addSelect('SUM(oi.subtotal)', 'totalRevenue')
//       .addSelect('AVG(oi.price)', 'averagePrice')
//       .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
//       .addSelect('o.branchId', 'branchId')
//       .addSelect('branch.name', 'branchName')
//       .groupBy('c.id, o.branchId, branch.id')
//       .addGroupBy('c.name')
//       .addOrderBy('SUM(oi.subtotal)', 'DESC')
//       .getRawMany()
//       .then((results) =>
//         results.map((r) => ({
//           categoryId: r.categoryId,
//           categoryName: r.categoryName,
//           totalUnits: Number(r.totalUnits) || 0,
//           totalRevenue: Number(r.totalRevenue) || 0,
//           averagePrice: Number(r.averagePrice) || 0,
//           ordersCount: Number(r.ordersCount) || 0,
//           branchId: r.branchId,
//           branchName: r.branchName
//         }))
//       );
//   }

//   // //////////////////////////////////////////////////////////////////////////////////////
//   // 6. VENTAS POR MARCAS
//   // //////////////////////////////////////////////////////////////////////////////////////
//   async getSalesByBrands(user: ReportAccessUser, filters: any = {}) {
//     const resolvedBranchId = resolveBranchScope(user, {
//       requestedBranchId: filters.branchId,
//       allowGlobal: true,
//       globalPermissions: ['view_reports'],
//       requireActiveBranch: false,
//       forbiddenMessage:
//         'No tienes acceso a la sucursal solicitada para reportes'
//     });

//     const fromDate = filters.from
//       ? parseReportDate(filters.from)
//       : new Date(new Date().getFullYear(), 0, 1);
//     const toDate = filters.to ? parseReportDate(filters.to) : new Date();

//     fromDate.setHours(0, 0, 0, 0);
//     toDate.setHours(23, 59, 59, 999);

//     const query = this.orderItemRepo
//       .createQueryBuilder('oi')
//       .leftJoin('oi.order', 'o')
//       .leftJoin('oi.variant', 'pv')
//       .leftJoin('pv.brand', 'b')
//       .leftJoin('o.branch', 'branch')
//       .where('o.status IN (:...statuses)', {
//         statuses: ['approved', 'completed']
//       })
//       .andWhere('o.createdAt BETWEEN :from AND :to', {
//         from: fromDate,
//         to: toDate
//       })
//       .andWhere('oi.approvedQuantity > 0')
//       .andWhere('b.id IS NOT NULL');

//     if (resolvedBranchId) {
//       query.andWhere('o.branchId = :branchId', { branchId: resolvedBranchId });
//     }

//     if (filters.search) {
//       query.andWhere('b.name ILIKE :search', { search: `%${filters.search}%` });
//     }

//     return await query
//       .select('b.id', 'brandId')
//       .addSelect('b.name', 'brandName')
//       .addSelect('SUM(oi.approvedQuantity)', 'totalUnits')
//       .addSelect('SUM(oi.subtotal)', 'totalRevenue')
//       .addSelect('AVG(oi.price)', 'averagePrice')
//       .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
//       .addSelect('o.branchId', 'branchId')
//       .addSelect('branch.name', 'branchName')
//       .groupBy('b.id, o.branchId, branch.id')
//       .addGroupBy('b.name')
//       .addOrderBy('SUM(oi.subtotal)', 'DESC')
//       .getRawMany()
//       .then((results) =>
//         results.map((r) => ({
//           brandId: r.brandId,
//           brandName: r.brandName,
//           totalUnits: Number(r.totalUnits) || 0,
//           totalRevenue: Number(r.totalRevenue) || 0,
//           averagePrice: Number(r.averagePrice) || 0,
//           ordersCount: Number(r.ordersCount) || 0,
//           branchId: r.branchId,
//           branchName: r.branchName
//         }))
//       );
//   }

//   async getStockSummary(
//     user: ReportAccessUser,
//     search?: string,
//     order: 'asc' | 'desc' = 'desc',
//     branchId?: string
//   ) {
//     const resolvedBranchId = resolveBranchScope(user, {
//       requestedBranchId: branchId,
//       allowGlobal: true,
//       globalPermissions: ['view_reports'],
//       requireActiveBranch: false,
//       forbiddenMessage:
//         'No tienes acceso a la sucursal solicitada para reportes'
//     });

//     if (!resolvedBranchId) {
//       return [];
//     }

//     const whereClause = search
//       ? { productBase: { name: ILike(`%${search}%`) } }
//       : {};

//     const variants = await this.variantRepo.find({
//       relations: ['productBase'],
//       where: whereClause
//     });

//     const variantsWithStock = await Promise.all(
//       variants.map(async (variant) => ({
//         ...variant,
//         stock: await this.productsBaseService.calculateStockByBranch(
//           variant.id,
//           resolvedBranchId
//         )
//       }))
//     );

//     const summary = variantsWithStock.reduce(
//       (acc, variant) => {
//         const productId = variant.productBase.id;

//         if (!acc[productId]) {
//           acc[productId] = {
//             productId,
//             productName: variant.productBase.name,
//             totalStock: 0,
//             variants: []
//           };
//         }

//         acc[productId].variants.push({
//           variantId: variant.id,
//           name: variant.name,
//           stock: variant.stock
//         });

//         acc[productId].totalStock += variant.stock;

//         return acc;
//       },
//       {} as Record<string, any>
//     );

//     return Object.values(summary).sort((a: any, b: any) =>
//       order === 'asc'
//         ? a.totalStock - b.totalStock
//         : b.totalStock - a.totalStock
//     );
//   }
// }


//refactor
import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, DataSource } from 'typeorm';
import { CashMovement, CashMovementType } from 'src/cash/entities/cash-movement.entity';
import { Sale } from 'src/sales/entities/sale.entity';
import { SalesReportFiltersDto } from './dto/sales-reports.dto';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class ReportsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
  ) {}

  /**
   * 1. REFACTOR FINANCE REPORT
   * Ahora incluye:
   * - Exclusión de movimientos revertidos (Fase 3).
   * - Cálculo de tendencias comparando con el período anterior.
   */
  async getFinanceReport(user: User, from?: string, to?: string, branchId?: string) {
    const scopeBranchId = this.validateScope(user, branchId);
    const startDate = from ? new Date(from) : this.startOfYear();
    const endDate = to ? new Date(to) : new Date();

    // Cálculo período actual
    const currentPeriod = await this.getFinancialTotals(startDate, endDate, scopeBranchId);

    // Cálculo período anterior (para tendencias)
    const duration = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - duration);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevPeriod = await this.getFinancialTotals(prevStartDate, prevEndDate, scopeBranchId);

    return {
      summary: {
        total_income: currentPeriod.income,
        total_expenses: currentPeriod.expenses,
        balance: currentPeriod.income - currentPeriod.expenses,
        movements_count: currentPeriod.count,
        trends: {
          income_change: this.calculateTrend(currentPeriod.income, prevPeriod.income),
          expenses_change: this.calculateTrend(currentPeriod.expenses, prevPeriod.expenses),
          balance_change: this.calculateTrend(
            currentPeriod.income - currentPeriod.expenses,
            prevPeriod.income - prevPeriod.expenses
          ),
        }
      },
      period: { from: startDate, to: endDate },
      prevPeriod: { from: prevStartDate, to: prevEndDate }
    };
  }

  /**
   * 2. REFACTOR SALES BY PRODUCTS
   * Asegura que el margen se calcule basado en el costo real y respete la sucursal.
   */
  async getSalesByProducts(user: User, filters: SalesReportFiltersDto) {
    const branchId = this.validateScope(user, filters.branchId);
    
    const query = this.saleRepo.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.productBase', 'productBase')
      .leftJoinAndSelect('productBase.category', 'category')
      .leftJoinAndSelect('productBase.brand', 'brand')
      .where('sale.branchId = :branchId', { branchId })
      .andWhere('sale.status = :status', { status: 'COMPLETED' });

    if (filters.from && filters.to) {
      query.andWhere('sale.createdAt BETWEEN :from AND :to', { from: filters.from, to: filters.to });
    }

    const sales = await query.getMany();
    const productMap = new Map();

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const id = item.product.id;
        const current = productMap.get(id) || {
          product_name: item.product.name,
          sku: item.product.sku,
          category: item.product.productBase?.category?.name || 'Sin Categoría',
          brand: item.product.productBase?.brand?.name || 'Sin Marca',
          quantity: 0,
          total_amount: 0,
          total_cost: 0
        };

        current.quantity += item.quantity;
        current.total_amount += item.price * item.quantity;
        current.total_cost += (item.cost || 0) * item.quantity;
        productMap.set(id, current);
      });
    });

    return Array.from(productMap.values()).map(p => ({
      ...p,
      margin: p.total_amount > 0 
        ? parseFloat((((p.total_amount - p.total_cost) / p.total_amount) * 100).toFixed(2))
        : 0
    }));
  }

  // --- HELPERS ---

  private async getFinancialTotals(start: Date, end: Date, branchId: string) {
    const moves = await this.cashMovementRepo.find({
      where: {
        createdAt: Between(start, end),
        branchId: branchId,
        isReversed: false // FILTRO CRÍTICO FASE 3
      }
    });

    return moves.reduce((acc, curr) => {
      if (curr.type === CashMovementType.INCOME) acc.income += curr.amount;
      else acc.expenses += curr.amount;
      acc.count++;
      return acc;
    }, { income: 0, expenses: 0, count: 0 });
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(2));
  }

  /**
   * Valida el acceso a una sucursal basándose en los roles del usuario.
   * Un usuario puede tener múltiples asignaciones de sucursal a través de branchAssignments.
   */
  private validateScope(user: User, requestedBranchId?: string): string {
    const roles = user.roles.map(r => r.name);
    const isGlobalAdmin = roles.some(role => ['root', 'gerente_general'].includes(role));

    // Si es admin global, puede ver cualquier sucursal (usa la solicitada o la primera asignada)
    if (isGlobalAdmin) {
      return requestedBranchId || user.branchAssignments?.[0]?.branch?.id || '';
    }

    // Si no es admin, buscamos sus sucursales asignadas a través de la relación 'branch'
    const assignedBranchIds = user.branchAssignments?.map(ba => ba.branch?.id).filter(id => !!id) || [];

    if (requestedBranchId) {
      if (!assignedBranchIds.includes(requestedBranchId)) {
        throw new ForbiddenException('No tiene permisos para acceder a esta sucursal');
      }
      return requestedBranchId;
    }

    // Si no solicita una específica, devolvemos su sucursal principal
    if (assignedBranchIds.length === 0) {
      throw new ForbiddenException('El usuario no tiene sucursales asignadas');
    }

    return assignedBranchIds[0];
  }

  private startOfYear(): Date {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}