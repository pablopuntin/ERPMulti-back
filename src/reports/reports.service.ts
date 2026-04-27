import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  CashMovement,
  CashMovementType
} from 'src/cash/entities/cash-movement.entity';
import { CashRegister } from 'src/cash/entities/cash-register.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { PriceChangeHistory } from 'src/price-history/entities/price-history.entity';
import { Order } from 'src/orders/entities/order.entity';
import { OrderItem } from 'src/orders/entities/order-item.entity';
import { PurchaseItem } from 'src/purchase/entities/purchase-item.entity';
import { Category } from 'src/categories/entities/category.entity';
import { Brand } from 'src/brands/entities/brand.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { ILike } from 'typeorm';
import { ProductsBaseService } from 'src/products-base/products-base.service';
import {
  BranchScopedUser,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ReportAccessUser = BranchScopedUser;

const parseReportDate = (value?: string, fallback?: Date) => {
  if (!value) {
    return fallback ? new Date(fallback) : new Date();
  }

  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(value);
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(CashMovement)
    private readonly movementRepo: Repository<CashMovement>,

    @InjectRepository(CashRegister)
    private readonly registerRepo: Repository<CashRegister>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(PriceChangeHistory)
    private readonly priceHistoryRepo: Repository<PriceChangeHistory>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepo: Repository<PurchaseItem>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,

    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,

    private readonly productsBaseService: ProductsBaseService
  ) {}

  // ─────────────────────────────────────────────────────────────
  //  📈 1. REPORTE DE INGRESOS / EGRESOS / BALANCE
  // ─────────────────────────────────────────────────────────────
  async getFinanceReport(
    user: ReportAccessUser,
    from?: string,
    to?: string,
    branchId?: string
  ) {
    // Defaults al año actual
    const currentYear = new Date().getFullYear();

    const fromDate = parseReportDate(from, new Date(currentYear, 0, 1));
    const toDate = parseReportDate(to, new Date(currentYear, 11, 31));
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });

    const income = await this.movementRepo
      .createQueryBuilder('m')
      .leftJoin('m.register', 'register')
      .where('m.type = :type', { type: CashMovementType.INCOME })
      .andWhere('m.createdAt BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate
      })
      .andWhere(
        resolvedBranchId ? 'register.branchId = :branchId' : '1=1',
        resolvedBranchId ? { branchId: resolvedBranchId } : {}
      )
      .select('SUM(m.amount)', 'total')
      .getRawOne();

    const expense = await this.movementRepo
      .createQueryBuilder('m')
      .leftJoin('m.register', 'register')
      .where('m.type = :type', { type: CashMovementType.EXPENSE })
      .andWhere('m.createdAt BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate
      })
      .andWhere(
        resolvedBranchId ? 'register.branchId = :branchId' : '1=1',
        resolvedBranchId ? { branchId: resolvedBranchId } : {}
      )
      .select('SUM(m.amount)', 'total')
      .getRawOne();

    const totalIncome = Number(income?.total || 0);
    const totalExpense = Number(expense?.total || 0);
    const balance = totalIncome - totalExpense;

    return {
      from: fromDate,
      to: toDate,
      branchId: resolvedBranchId,
      totalIncome,
      totalExpense,
      balance
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  📜 2. DETALLES DE LOS MOVIMIENTOS (INGRESOS/EGRESOS)
  // ─────────────────────────────────────────────────────────────
  async getCashMovements(
    user: ReportAccessUser,
    type?: CashMovementType,
    from?: string,
    to?: string,
    branchId?: string
  ) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });
    const query = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.register', 'register')
      .orderBy('m.createdAt', 'DESC');

    if (type) {
      query.andWhere('m.type = :type', { type });
    }

    if (from) {
      const fromDate = parseReportDate(from);
      fromDate.setHours(0, 0, 0, 0);
      query.andWhere('m.createdAt >= :from', { from: fromDate });
    }

    if (to) {
      const toDate = parseReportDate(to);
      toDate.setHours(23, 59, 59, 999);
      query.andWhere('m.createdAt <= :to', { to: toDate });
    }

    if (resolvedBranchId) {
      query.andWhere('register.branchId = :branchId', {
        branchId: resolvedBranchId
      });
    }

    const movements = await query.getMany();

    const extractOrderReference = (reason?: string) => {
      const normalizedReason = String(reason || '');
      const remitoMatch = normalizedReason.match(
        /Pago\s+([^\s]+)\s+-\s+Remito\s+([^\s]+)/i
      );
      if (remitoMatch) {
        return {
          paymentMethod: remitoMatch[1]?.toLowerCase() || 'cash',
          remitoNumber: remitoMatch[2]
        };
      }

      const legacyOrderMatch = normalizedReason.match(
        /Pago\s+([^\s]+)\s+-\s+Orden\s+([a-f0-9-]{36})/i
      );
      if (legacyOrderMatch) {
        return {
          paymentMethod: legacyOrderMatch[1]?.toLowerCase() || 'cash',
          orderId: legacyOrderMatch[2]
        };
      }

      return {
        paymentMethod: 'cash'
      };
    };

    const paymentMovementOrderIds = Array.from(
      new Set(
        movements
          .map(
            (movement) => extractOrderReference(movement.reason).orderId || null
          )
          .filter(Boolean)
      )
    );

    const paymentMovementRemitos = Array.from(
      new Set(
        movements
          .map(
            (movement) =>
              extractOrderReference(movement.reason).remitoNumber || null
          )
          .filter(Boolean)
      )
    );

    const relatedOrdersById =
      paymentMovementOrderIds.length > 0
        ? await this.orderRepo.find({
            where: paymentMovementOrderIds.map((id) => ({ id: id as string })),
            relations: ['user', 'customer']
          })
        : [];

    const relatedOrdersByRemito =
      paymentMovementRemitos.length > 0
        ? await this.orderRepo.find({
            where: paymentMovementRemitos.map((remitoNumber) => ({
              remitoNumber: remitoNumber as string
            })),
            relations: ['user', 'customer']
          })
        : [];

    const orderMap = new Map(
      relatedOrdersById.map((order) => [order.id, order])
    );
    const remitoMap = new Map(
      relatedOrdersByRemito.map((order) => [order.remitoNumber, order])
    );

    return movements.map((movement) => {
      const { paymentMethod, orderId, remitoNumber } = extractOrderReference(
        movement.reason
      );
      const relatedOrder = orderId
        ? orderMap.get(orderId)
        : remitoNumber
          ? remitoMap.get(remitoNumber)
          : undefined;
      const sellerName = relatedOrder
        ? [relatedOrder.user?.firstname, relatedOrder.user?.lastname]
            .filter(Boolean)
            .join(' ') || 'Sin vendedor'
        : undefined;
      const customerName =
        relatedOrder?.customerNameSnapshot ||
        relatedOrder?.customer?.fullName ||
        undefined;
      const shortOrderId = orderId
        ? orderId.slice(0, 8).toUpperCase()
        : undefined;
      const resolvedReference =
        relatedOrder?.remitoNumber ||
        remitoNumber ||
        shortOrderId ||
        movement.register?.id;

      const description = relatedOrder
        ? `Cobro remito ${relatedOrder.remitoNumber || shortOrderId}${customerName ? ` · ${customerName}` : ''}${sellerName ? ` · Vendió ${sellerName}` : ''}`
        : movement.reason || 'Movimiento de caja';

      return {
        ...movement,
        paymentMethod,
        orderId,
        remitoNumber: relatedOrder?.remitoNumber || remitoNumber,
        sellerName,
        customerName,
        description,
        referenceLabel: resolvedReference
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  🧮 3. RESUMEN DE RENTABILIDAD (VENTAS - COMPRAS)
  // ─────────────────────────────────────────────────────────────
  async getProfit(
    user: ReportAccessUser,
    from?: string,
    to?: string,
    branchId?: string
  ) {
    return this.getFinanceReport(user, from, to, branchId); // mismo default
  }

  // ─────────────────────────────────────────────────────────────
  //  🗓 4. RESUMEN DIARIO DE CAJA
  // ─────────────────────────────────────────────────────────────
  async getDailySummary(
    user: ReportAccessUser,
    date?: string,
    branchId?: string
  ) {
    const target = parseReportDate(date);

    const start = new Date(target);
    start.setHours(0, 0, 0, 0);

    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    return this.getFinanceReport(
      user,
      start.toISOString(),
      end.toISOString(),
      branchId
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  🔍 5. REPORTE DE CAMBIOS DE PRECIO (ya lo tenías)
  // ─────────────────────────────────────────────────────────────
  async getPriceChanges({ from, to }: { from?: string; to?: string }) {
    const where =
      from && to ? { changedAt: Between(new Date(from), new Date(to)) } : {};
    return this.priceHistoryRepo.find({ where, order: { changedAt: 'DESC' } });
  }

  // ─────────────────────────────────────────────────────────────
  //  📦 6. REPORTE DE STOCK (ya mejorado)
  // ─────────────────────────────────────────────────────────────
  // //////////////////////////////////////////////////////////////////////////////////////
  // 4. VENTAS POR PRODUCTOS (con márgenes)
  // //////////////////////////////////////////////////////////////////////////////////////
  async getSalesByProducts(user: ReportAccessUser, filters: any = {}) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: filters.branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });

    const fromDate = filters.from
      ? parseReportDate(filters.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters.to ? parseReportDate(filters.to) : new Date();

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // Base query para ventas
    const query = this.orderItemRepo
      .createQueryBuilder('oi')
      .leftJoin('oi.order', 'o')
      .leftJoin('oi.variant', 'pv')
      .leftJoin('pv.productBase', 'pb')
      .leftJoin('pv.category', 'c')
      .leftJoin('pv.brand', 'b')
      .leftJoin('o.branch', 'branch')
      .where('o.status IN (:...statuses)', {
        statuses: ['approved', 'completed']
      })
      .andWhere('o.createdAt BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate
      })
      .andWhere('oi.approvedQuantity > 0');

    if (resolvedBranchId) {
      query.andWhere('o.branchId = :branchId', { branchId: resolvedBranchId });
    }

    if (filters.categoryId) {
      query.andWhere('c.id = :categoryId', { categoryId: filters.categoryId });
    }

    if (filters.brandId) {
      query.andWhere('b.id = :brandId', { brandId: filters.brandId });
    }

    if (filters.productId) {
      query.andWhere('pb.id = :productId', { productId: filters.productId });
    }

    if (filters.search) {
      query.andWhere(
        '(pv.name ILIKE :search OR pv.sku ILIKE :search OR pb.name ILIKE :search)',
        {
          search: `%${filters.search}%`
        }
      );
    }

    const sales = await query
      .select('pv.id', 'productId')
      .addSelect('COALESCE(pb.name, pv.name)', 'productName')
      .addSelect('pv.sku', 'productSku')
      .addSelect('c.id', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect('b.id', 'brandId')
      .addSelect('b.name', 'brandName')
      .addSelect('SUM(oi.approvedQuantity)', 'totalUnits')
      .addSelect('SUM(oi.subtotal)', 'totalRevenue')
      .addSelect('AVG(oi.price)', 'averagePrice')
      .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
      .addSelect('o.branchId', 'branchId')
      .addSelect('branch.name', 'branchName')
      .groupBy('pv.id, c.id, b.id, o.branchId, branch.id')
      .addGroupBy('pb.name')
      .addGroupBy('pv.name')
      .addGroupBy('pv.sku')
      .addGroupBy('c.name')
      .addGroupBy('b.name')
      .addOrderBy('SUM(oi.subtotal)', 'DESC')
      .getRawMany();

    return sales.map((sale) => {
      return {
        productId: sale.productId,
        productName: sale.productName,
        productSku: sale.productSku,
        categoryId: sale.categoryId,
        categoryName: sale.categoryName,
        brandId: sale.brandId,
        brandName: sale.brandName,
        totalUnits: Number(sale.totalUnits) || 0,
        totalRevenue: Number(sale.totalRevenue) || 0,
        averagePrice: Number(sale.averagePrice) || 0,
        lastCostPrice: undefined,
        totalCost: undefined,
        marginAmount: undefined,
        marginPercentage: undefined,
        ordersCount: Number(sale.ordersCount) || 0,
        branchId: sale.branchId,
        branchName: sale.branchName
      };
    });
  }

  // //////////////////////////////////////////////////////////////////////////////////////
  // 5. VENTAS POR CATEGORÍAS
  // //////////////////////////////////////////////////////////////////////////////////////
  async getSalesByCategories(user: ReportAccessUser, filters: any = {}) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: filters.branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });

    const fromDate = filters.from
      ? parseReportDate(filters.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters.to ? parseReportDate(filters.to) : new Date();

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const query = this.orderItemRepo
      .createQueryBuilder('oi')
      .leftJoin('oi.order', 'o')
      .leftJoin('oi.variant', 'pv')
      .leftJoin('pv.category', 'c')
      .leftJoin('o.branch', 'branch')
      .where('o.status IN (:...statuses)', {
        statuses: ['approved', 'completed']
      })
      .andWhere('o.createdAt BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate
      })
      .andWhere('oi.approvedQuantity > 0')
      .andWhere('c.id IS NOT NULL');

    if (resolvedBranchId) {
      query.andWhere('o.branchId = :branchId', { branchId: resolvedBranchId });
    }

    if (filters.search) {
      query.andWhere('c.name ILIKE :search', { search: `%${filters.search}%` });
    }

    return await query
      .select('c.id', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect('SUM(oi.approvedQuantity)', 'totalUnits')
      .addSelect('SUM(oi.subtotal)', 'totalRevenue')
      .addSelect('AVG(oi.price)', 'averagePrice')
      .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
      .addSelect('o.branchId', 'branchId')
      .addSelect('branch.name', 'branchName')
      .groupBy('c.id, o.branchId, branch.id')
      .addGroupBy('c.name')
      .addOrderBy('SUM(oi.subtotal)', 'DESC')
      .getRawMany()
      .then((results) =>
        results.map((r) => ({
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          totalUnits: Number(r.totalUnits) || 0,
          totalRevenue: Number(r.totalRevenue) || 0,
          averagePrice: Number(r.averagePrice) || 0,
          ordersCount: Number(r.ordersCount) || 0,
          branchId: r.branchId,
          branchName: r.branchName
        }))
      );
  }

  // //////////////////////////////////////////////////////////////////////////////////////
  // 6. VENTAS POR MARCAS
  // //////////////////////////////////////////////////////////////////////////////////////
  async getSalesByBrands(user: ReportAccessUser, filters: any = {}) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: filters.branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });

    const fromDate = filters.from
      ? parseReportDate(filters.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters.to ? parseReportDate(filters.to) : new Date();

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const query = this.orderItemRepo
      .createQueryBuilder('oi')
      .leftJoin('oi.order', 'o')
      .leftJoin('oi.variant', 'pv')
      .leftJoin('pv.brand', 'b')
      .leftJoin('o.branch', 'branch')
      .where('o.status IN (:...statuses)', {
        statuses: ['approved', 'completed']
      })
      .andWhere('o.createdAt BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate
      })
      .andWhere('oi.approvedQuantity > 0')
      .andWhere('b.id IS NOT NULL');

    if (resolvedBranchId) {
      query.andWhere('o.branchId = :branchId', { branchId: resolvedBranchId });
    }

    if (filters.search) {
      query.andWhere('b.name ILIKE :search', { search: `%${filters.search}%` });
    }

    return await query
      .select('b.id', 'brandId')
      .addSelect('b.name', 'brandName')
      .addSelect('SUM(oi.approvedQuantity)', 'totalUnits')
      .addSelect('SUM(oi.subtotal)', 'totalRevenue')
      .addSelect('AVG(oi.price)', 'averagePrice')
      .addSelect('COUNT(DISTINCT o.id)', 'ordersCount')
      .addSelect('o.branchId', 'branchId')
      .addSelect('branch.name', 'branchName')
      .groupBy('b.id, o.branchId, branch.id')
      .addGroupBy('b.name')
      .addOrderBy('SUM(oi.subtotal)', 'DESC')
      .getRawMany()
      .then((results) =>
        results.map((r) => ({
          brandId: r.brandId,
          brandName: r.brandName,
          totalUnits: Number(r.totalUnits) || 0,
          totalRevenue: Number(r.totalRevenue) || 0,
          averagePrice: Number(r.averagePrice) || 0,
          ordersCount: Number(r.ordersCount) || 0,
          branchId: r.branchId,
          branchName: r.branchName
        }))
      );
  }

  async getStockSummary(
    user: ReportAccessUser,
    search?: string,
    order: 'asc' | 'desc' = 'desc',
    branchId?: string
  ) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });

    if (!resolvedBranchId) {
      return [];
    }

    const whereClause = search
      ? { productBase: { name: ILike(`%${search}%`) } }
      : {};

    const variants = await this.variantRepo.find({
      relations: ['productBase'],
      where: whereClause
    });

    const variantsWithStock = await Promise.all(
      variants.map(async (variant) => ({
        ...variant,
        stock: await this.productsBaseService.calculateStockByBranch(
          variant.id,
          resolvedBranchId
        )
      }))
    );

    const summary = variantsWithStock.reduce(
      (acc, variant) => {
        const productId = variant.productBase.id;

        if (!acc[productId]) {
          acc[productId] = {
            productId,
            productName: variant.productBase.name,
            totalStock: 0,
            variants: []
          };
        }

        acc[productId].variants.push({
          variantId: variant.id,
          name: variant.name,
          stock: variant.stock
        });

        acc[productId].totalStock += variant.stock;

        return acc;
      },
      {} as Record<string, any>
    );

    return Object.values(summary).sort((a: any, b: any) =>
      order === 'asc'
        ? a.totalStock - b.totalStock
        : b.totalStock - a.totalStock
    );
  }
}
