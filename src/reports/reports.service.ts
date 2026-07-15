import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  Repository
} from 'typeorm';

import {
  CashMovement,
  CashMovementType
} from 'src/cash/entities/cash-movement.entity';

import { CashRegister } from 'src/cash/entities/cash-register.entity';

import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

import { PriceChangeHistory } from 'src/price-history/entities/price-history.entity';

import { Sale } from 'src/sales/entities/sale.entity';
import { SaleItem } from 'src/sales/entities/sale-item.entity';

import {
  BranchScopedUser,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ReportAccessUser = BranchScopedUser;

const parseReportDate = (
  value?: string,
  fallback?: Date
): Date => {
  if (!value) {
    return fallback ? new Date(fallback) : new Date();
  }

  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
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

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>
  ) {}

  // =========================================================
  // HELPERS
  // =========================================================

  private resolveReportBranch(
    user: ReportAccessUser,
    branchId?: string
  ) {
    return resolveBranchScope(user, {
      requestedBranchId: branchId,
      allowGlobal: true,
      globalPermissions: ['view_reports'],
      requireActiveBranch: false,
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para reportes'
    });
  }

  private normalizeDateRange(
    from?: string,
    to?: string
  ) {
    const currentYear = new Date().getFullYear();

    const fromDate = parseReportDate(
      from,
      new Date(currentYear, 0, 1)
    );

    const toDate = parseReportDate(
      to,
      new Date(currentYear, 11, 31)
    );

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    return {
      fromDate,
      toDate
    };
  }

  private calculateTrend(
    current: number,
    previous: number
  ): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    return Number(
      (
        ((current - previous) / previous) *
        100
      ).toFixed(2)
    );
  }

  // =========================================================
  // 1. FINANCE REPORT
  // =========================================================

  async getFinanceReport(
    user: ReportAccessUser,
    from?: string,
    to?: string,
    branchId?: string
  ) {
    const { fromDate, toDate } =
      this.normalizeDateRange(from, to);

    const resolvedBranchId =
      this.resolveReportBranch(user, branchId);

    const totals = await this.movementRepo
      .createQueryBuilder('m')
      .innerJoin('m.register', 'register')
      .where('m.createdAt BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate
      })
      .andWhere(
        resolvedBranchId
          ? 'register.branchId = :branchId'
          : '1=1',
        resolvedBranchId
          ? { branchId: resolvedBranchId }
          : {}
      )
      .select(
        `
        COALESCE(
          SUM(
            CASE
              WHEN m.type = :incomeType
              THEN m.amount
              ELSE 0
            END
          ),
          0
        )
        `,
        'totalIncome'
      )
      .addSelect(
        `
        COALESCE(
          SUM(
            CASE
              WHEN m.type = :expenseType
              THEN m.amount
              ELSE 0
            END
          ),
          0
        )
        `,
        'totalExpense'
      )
      .setParameters({
        incomeType: CashMovementType.INCOME,
        expenseType: CashMovementType.EXPENSE
      })
      .getRawOne();

    const totalIncome = Number(
      totals?.totalIncome || 0
    );

    const totalExpense = Number(
      totals?.totalExpense || 0
    );

    const balance =
      totalIncome - totalExpense;

    const duration =
      toDate.getTime() - fromDate.getTime();

    const prevFrom = new Date(
      fromDate.getTime() - duration
    );

    const prevTo = new Date(
      fromDate.getTime() - 1
    );

    const prevTotals = await this.movementRepo
      .createQueryBuilder('m')
      .innerJoin('m.register', 'register')
      .where('m.createdAt BETWEEN :from AND :to', {
        from: prevFrom,
        to: prevTo
      })
      .andWhere(
        resolvedBranchId
          ? 'register.branchId = :branchId'
          : '1=1',
        resolvedBranchId
          ? { branchId: resolvedBranchId }
          : {}
      )
      .select(
        `
        COALESCE(
          SUM(
            CASE
              WHEN m.type = :incomeType
              THEN m.amount
              ELSE 0
            END
          ),
          0
        )
        `,
        'totalIncome'
      )
      .addSelect(
        `
        COALESCE(
          SUM(
            CASE
              WHEN m.type = :expenseType
              THEN m.amount
              ELSE 0
            END
          ),
          0
        )
        `,
        'totalExpense'
      )
      .setParameters({
        incomeType: CashMovementType.INCOME,
        expenseType: CashMovementType.EXPENSE
      })
      .getRawOne();

    const prevIncome = Number(
      prevTotals?.totalIncome || 0
    );

    const prevExpense = Number(
      prevTotals?.totalExpense || 0
    );

    const prevBalance =
      prevIncome - prevExpense;

    return {
      totalIncome,
      totalExpense,
      balance,

      trends: {
        income: this.calculateTrend(
          totalIncome,
          prevIncome
        ),

        expense: this.calculateTrend(
          totalExpense,
          prevExpense
        ),

        balance: this.calculateTrend(
          balance,
          prevBalance
        )
      },

      from: fromDate,
      to: toDate,
      branchId: resolvedBranchId
    };
  }

  // =========================================================
  // 2. CASH MOVEMENTS
  // =========================================================

  async getCashMovements(
    user: ReportAccessUser,
    type?: CashMovementType,
    from?: string,
    to?: string,
    branchId?: string
  ) {
    const resolvedBranchId =
      this.resolveReportBranch(user, branchId);

    const query = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect(
        'm.register',
        'register'
      )
      .orderBy('m.createdAt', 'DESC');

    if (type) {
      query.andWhere('m.type = :type', {
        type
      });
    }

    if (from) {
      const fromDate = parseReportDate(from);

      fromDate.setHours(0, 0, 0, 0);

      query.andWhere(
        'm.createdAt >= :from',
        {
          from: fromDate
        }
      );
    }

    if (to) {
      const toDate = parseReportDate(to);

      toDate.setHours(
        23,
        59,
        59,
        999
      );

      query.andWhere('m.createdAt <= :to', {
        to: toDate
      });
    }

    if (resolvedBranchId) {
      query.andWhere(
        'register.branchId = :branchId',
        {
          branchId: resolvedBranchId
        }
      );
    }

    const movements = await query.getMany();

    return movements.map((movement) => ({
      ...movement,
      description:
        movement.reason ||
        'Movimiento de caja'
    }));
  }

  // =========================================================
  // 3. PROFIT
  // =========================================================

  async getProfit(
    user: ReportAccessUser,
    from?: string,
    to?: string,
    branchId?: string
  ) {
    return this.getFinanceReport(
      user,
      from,
      to,
      branchId
    );
  }

  // =========================================================
  // 4. DAILY SUMMARY
  // =========================================================

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

  // =========================================================
  // 5. PRICE CHANGES
  // =========================================================

  async getPriceChanges(filters: {
    from?: string;
    to?: string;
  }) {
    let where:
      | FindOptionsWhere<PriceChangeHistory>
      | undefined;

    if (filters.from && filters.to) {
      where = {
        changedAt: Between(
          new Date(filters.from),
          new Date(filters.to)
        )
      };
    }

    return this.priceHistoryRepo.find({
      where,
      order: {
        changedAt: 'DESC'
      }
    });
  }

  // =========================================================
  // 6. SALES BY PRODUCTS
  // =========================================================

  async getSalesByProducts(
    user: ReportAccessUser,
    filters: any = {}
  ) {
    const resolvedBranchId =
      this.resolveReportBranch(
        user,
        filters.branchId
      );

    const { fromDate, toDate } =
      this.normalizeDateRange(
        filters.from,
        filters.to
      );

    const query = this.saleItemRepo
      .createQueryBuilder('si')
      .leftJoin('si.sale', 's')
      .leftJoin('si.productVariant', 'pv')
      .leftJoin('pv.productBase', 'pb')
      .leftJoin('pb.category', 'c')
      .leftJoin('pb.brand', 'b')
      .where(
        's.confirmedAt BETWEEN :from AND :to',
        {
          from: fromDate,
          to: toDate
        }
      );

    if (resolvedBranchId) {
      query.andWhere(
        's.branchId = :branchId',
        {
          branchId: resolvedBranchId
        }
      );
    }

    if (filters.search) {
      query.andWhere(
        `
        (
          pb.name ILIKE :search
          OR pv.name ILIKE :search
          OR pv.sku ILIKE :search
        )
        `,
        {
          search: `%${filters.search}%`
        }
      );
    }

    return query
      .select('pv.id', 'productId')
      .addSelect(
        'COALESCE(pb.name, pv.name)',
        'productName'
      )
      .addSelect('pv.sku', 'productSku')
      .addSelect('c.name', 'categoryName')
      .addSelect('b.name', 'brandName')
      .addSelect(
        'SUM(si.quantitySold)',
        'totalUnits'
      )
      .addSelect(
        'SUM(si.lineTotal)',
        'totalRevenue'
      )
      .addSelect(
        'AVG(si.unitPrice)',
        'averagePrice'
      )
      .groupBy('pv.id')
      .addGroupBy('pb.name')
      .addGroupBy('pv.name')
      .addGroupBy('pv.sku')
      .addGroupBy('c.name')
      .addGroupBy('b.name')
      .orderBy(
        'SUM(si.lineTotal)',
        'DESC'
      )
      .getRawMany();
  }

  // =========================================================
  // 7. SALES BY CATEGORIES
  // =========================================================

  async getSalesByCategories(
    user: ReportAccessUser,
    filters: any = {}
  ) {
    const resolvedBranchId =
      this.resolveReportBranch(
        user,
        filters.branchId
      );

    const { fromDate, toDate } =
      this.normalizeDateRange(
        filters.from,
        filters.to
      );

    const query = this.saleItemRepo
      .createQueryBuilder('si')
      .leftJoin('si.sale', 's')
      .leftJoin('si.productVariant', 'pv')
      .leftJoin('pv.productBase', 'pb')
      .leftJoin('pb.category', 'c')
      .where(
        's.confirmedAt BETWEEN :from AND :to',
        {
          from: fromDate,
          to: toDate
        }
      );

    if (resolvedBranchId) {
      query.andWhere(
        's.branchId = :branchId',
        {
          branchId: resolvedBranchId
        }
      );
    }

    return query
      .select('c.id', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect(
        'SUM(si.quantitySold)',
        'totalUnits'
      )
      .addSelect(
        'SUM(si.lineTotal)',
        'totalRevenue'
      )
      .addSelect(
        'COUNT(DISTINCT s.id)',
        'salesCount'
      )
      .groupBy('c.id')
      .addGroupBy('c.name')
      .orderBy(
        'SUM(si.lineTotal)',
        'DESC'
      )
      .getRawMany();
  }

  // =========================================================
  // 8. SALES BY BRANDS
  // =========================================================

  async getSalesByBrands(
    user: ReportAccessUser,
    filters: any = {}
  ) {
    const resolvedBranchId =
      this.resolveReportBranch(
        user,
        filters.branchId
      );

    const { fromDate, toDate } =
      this.normalizeDateRange(
        filters.from,
        filters.to
      );

    const query = this.saleItemRepo
      .createQueryBuilder('si')
      .leftJoin('si.sale', 's')
      .leftJoin('si.productVariant', 'pv')
      .leftJoin('pv.productBase', 'pb')
      .leftJoin('pb.brand', 'b')
      .where(
        's.confirmedAt BETWEEN :from AND :to',
        {
          from: fromDate,
          to: toDate
        }
      );

    if (resolvedBranchId) {
      query.andWhere(
        's.branchId = :branchId',
        {
          branchId: resolvedBranchId
        }
      );
    }

    return query
      .select('b.id', 'brandId')
      .addSelect('b.name', 'brandName')
      .addSelect(
        'SUM(si.quantitySold)',
        'totalUnits'
      )
      .addSelect(
        'SUM(si.lineTotal)',
        'totalRevenue'
      )
      .addSelect(
        'COUNT(DISTINCT s.id)',
        'salesCount'
      )
      .groupBy('b.id')
      .addGroupBy('b.name')
      .orderBy(
        'SUM(si.lineTotal)',
        'DESC'
      )
      .getRawMany();
  }

  // =========================================================
  // 9. STOCK SUMMARY
  // =========================================================

  async getStockSummary(
    user: ReportAccessUser,
    search?: string,
    order: 'asc' | 'desc' = 'desc',
    branchId?: string
  ) {
    const resolvedBranchId =
      this.resolveReportBranch(
        user,
        branchId
      );

    const query = this.variantRepo
      .createQueryBuilder('pv')
      .leftJoinAndSelect('pv.productBase', 'pb')
      .leftJoinAndSelect('pv.stockLocations', 'sl');

    if (search) {
      query.andWhere(
        `
        (
          pb.name ILIKE :search
          OR pv.name ILIKE :search
          OR pv.sku ILIKE :search
        )
        `,
        {
          search: `%${search}%`
        }
      );
    }

    if (resolvedBranchId) {
      query.andWhere(
        'sl.branchId = :branchId',
        {
          branchId: resolvedBranchId
        }
      );
    }

    const variants = await query.getMany();

    const grouped = new Map();

    for (const variant of variants) {
      if (!variant.productBase) {
        continue;
      }

      const productBase =
        variant.productBase;

      if (!grouped.has(productBase.id)) {
        grouped.set(productBase.id, {
          productId: productBase.id,
          productName: productBase.name,
          totalStock: 0,
          variants: []
        });
      }

      const stock = (
        variant.stockLocations || []
      )
        .filter((sl: any) =>
          resolvedBranchId
            ? sl.branchId ===
              resolvedBranchId
            : true
        )
        .reduce(
          (sum: number, sl: any) =>
            sum +
            Number(sl.quantity || 0),
          0
        );

      const entry = grouped.get(
        productBase.id
      );

      entry.totalStock += stock;

      entry.variants.push({
        variantId: variant.id,
        name: variant.name,
        sku: variant.sku,
        stock
      });
    }

    return Array.from(
      grouped.values()
    ).sort((a: any, b: any) =>
      order === 'asc'
        ? a.totalStock -
          b.totalStock
        : b.totalStock -
          a.totalStock
    );
  }
}