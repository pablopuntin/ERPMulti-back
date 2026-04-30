import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus
} from 'src/orders/entities/order.entity';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import {
  Sale,
  SalePaymentPlanType,
  SaleStatus
} from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private resolveSaleStatus(order: Order) {
    if (order.status === OrderStatus.CANCELLED) {
      return SaleStatus.CANCELLED;
    }

    const fulfillmentStatus = order.fulfillmentStatus;
    const paymentStatus = order.paymentStatus;

    if (
      paymentStatus === OrderPaymentStatus.PAID &&
      fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
    ) {
      return SaleStatus.PAID;
    }

    if (
      paymentStatus === OrderPaymentStatus.PAID &&
      fulfillmentStatus !== OrderFulfillmentStatus.DELIVERED
    ) {
      return SaleStatus.PAID_AND_PENDING_DELIVERY;
    }

    if (
      paymentStatus === OrderPaymentStatus.PARTIALLY_PAID &&
      fulfillmentStatus !== OrderFulfillmentStatus.DELIVERED
    ) {
      return SaleStatus.PARTIALLY_PAID_AND_PENDING_DELIVERY;
    }

    if (fulfillmentStatus === OrderFulfillmentStatus.PARTIALLY_DELIVERED) {
      return SaleStatus.PARTIALLY_DELIVERED;
    }

    if (fulfillmentStatus === OrderFulfillmentStatus.DELIVERED) {
      return paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
        ? SaleStatus.PARTIALLY_PAID
        : SaleStatus.DELIVERED;
    }

    if (
      fulfillmentStatus === OrderFulfillmentStatus.PENDING ||
      fulfillmentStatus === OrderFulfillmentStatus.PENDING_STOCK
    ) {
      return paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
        ? SaleStatus.PARTIALLY_PAID_AND_PENDING_DELIVERY
        : SaleStatus.PENDING_DELIVERY;
    }

    if (order.paymentStatus === OrderPaymentStatus.PAID) {
      return SaleStatus.PAID;
    }

    if (Number(order.amountPaid || 0) > 0) {
      return SaleStatus.PARTIALLY_PAID;
    }

    return SaleStatus.OPEN;
  }

  async findAll(
    userScope: BranchScopedUser,
    filters: { branchId?: string; customerId?: string } = {}
  ) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: filters.branchId,
      allowGlobal: true,
      globalPermissions: ['view_all_reports', 'view_reports'],
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para consultar ventas',
      forbiddenMessage: 'No tienes acceso a la sucursal solicitada para ventas'
    });

    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.order', 'order')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.sellerUser', 'sellerUser')
      .leftJoinAndSelect('sale.cashierUser', 'cashierUser')
      .orderBy('sale.confirmedAt', 'DESC')
      .addOrderBy('sale.createdAt', 'DESC');

    if (resolvedBranchId) {
      qb.andWhere('sale.branchId = :branchId', { branchId: resolvedBranchId });
    }

    if (filters.customerId) {
      qb.andWhere('sale.customerId = :customerId', {
        customerId: filters.customerId
      });
    }

    return qb.getMany();
  }

  async findOne(userScope: BranchScopedUser, id: string) {
    const sale = await this.saleRepo.findOne({
      where: { id }
    });

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    ensureBranchAccess(
      userScope,
      sale.branchId,
      'No tienes acceso a la sucursal de esta venta',
      ['view_all_reports', 'view_reports']
    );

    return sale;
  }

  private resolvePaymentPlanType(order: Order) {
    const approvedTotal = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    const amountPaid = this.roundCurrency(Number(order.amountPaid || 0));

    if (amountPaid <= 0) {
      return SalePaymentPlanType.CURRENT_ACCOUNT;
    }

    if (amountPaid >= approvedTotal) {
      return SalePaymentPlanType.CASH;
    }

    return SalePaymentPlanType.MIXED;
  }

  private async generateSaleNumber() {
    while (true) {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const candidate = `SAL-${timestamp}-${random}`;
      const exists = await this.saleRepo.findOne({
        where: { saleNumber: candidate }
      });
      if (!exists) {
        return candidate;
      }
    }
  }

  async createFromOrder(params: {
    order: Order;
    cashierUserId?: string;
    createdByUserId?: string;
  }) {
    const { order, cashierUserId, createdByUserId } = params;

    const existing = await this.saleRepo.findOne({
      where: { orderId: order.id }
    });

    if (existing) {
      return existing;
    }

    const approvedTotal = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    const amountPaid = this.roundCurrency(Number(order.amountPaid || 0));
    const financedAmount = this.roundCurrency(
      Math.max(approvedTotal - amountPaid, 0)
    );
    const cashierNameSnapshot =
      order.paymentStatus !== OrderPaymentStatus.UNPAID &&
      (cashierUserId || createdByUserId)
        ? undefined
        : undefined;

    const sale = this.saleRepo.create({
      saleNumber: await this.generateSaleNumber(),
      orderId: order.id,
      branchId: order.branchId,
      customerId: order.customerId,
      customerNameSnapshot: order.customer?.fullName || order.customerNameSnapshot,
      customerDocumentSnapshot: order.customer?.document,
      sellerUserId: order.user?.id,
      sellerNameSnapshot: order.user
        ? `${order.user.firstname} ${order.user.lastname}`.trim()
        : undefined,
      createdByUserId: createdByUserId || cashierUserId || order.user?.id,
      cashierUserId: cashierUserId || createdByUserId,
      cashierNameSnapshot,
      orderRemitoNumberSnapshot: order.remitoNumber,
      saleType: 'standard',
      pricingMode: 'order_snapshot',
      currency: 'ARS',
      notes: order.notes,
      subtotal: approvedTotal,
      discountTotal: 0,
      surchargeTotal: 0,
      total: approvedTotal,
      amountPaidAtSale: amountPaid,
      financedAmount,
      paymentPlanType: this.resolvePaymentPlanType(order),
      saleStatus: this.resolveSaleStatus(order),
      confirmedAt: order.finalizedInCashAt || new Date(),
      items: (order.items || [])
        .filter((item) => Number(item.approvedQuantity || 0) > 0)
        .map((item) => {
          const quantitySold = Number(item.approvedQuantity || 0);
          const unitPrice = Number(item.price || 0);
          return this.saleItemRepo.create({
            orderItemId: item.id,
            productVariantId: item.variant?.id,
            productNameSnapshot: item.variant?.name || 'Producto',
            skuSnapshot: item.variant?.sku || undefined,
            quantitySold,
            unitPrice,
            discountAmount: 0,
            surchargeAmount: 0,
            lineTotal: this.roundCurrency(quantitySold * unitPrice),
            quantityOrdered: Number(item.quantity || 0),
            quantityDeliveredAtSale: Number(item.deliveredQuantity || 0),
            variantNameSnapshot: item.variant?.name || 'Producto',
            notes: item.notes
          });
        })
    });

    return this.saleRepo.save(sale);
  }
}
