import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderFulfillmentStatus } from 'src/orders/entities/order.entity';
import { OrderDeliveryEvent } from 'src/orders/entities/order-delivery-event.entity';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import { Remito, RemitoSourceType, RemitoStatus } from './entities/remito.entity';
import { RemitoItem } from './entities/remito-item.entity';
import { RemitoPdfService } from './remito-pdf.service';

@Injectable()
export class RemitosService {
  constructor(
    @InjectRepository(Remito)
    private readonly remitoRepo: Repository<Remito>,
    @InjectRepository(RemitoItem)
    private readonly remitoItemRepo: Repository<RemitoItem>,
    private readonly remitoPdfService: RemitoPdfService
  ) {}

  async findAll(
    userScope: BranchScopedUser,
    filters: {
      branchId?: string;
      saleId?: string;
      orderId?: string;
      customerId?: string;
    } = {}
  ) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: filters.branchId,
      allowGlobal: true,
      globalPermissions: ['view_all_reports', 'view_reports'],
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para consultar remitos',
      forbiddenMessage: 'No tienes acceso a la sucursal solicitada para remitos'
    });

    const qb = this.remitoRepo
      .createQueryBuilder('remito')
      .leftJoinAndSelect('remito.items', 'items')
      .leftJoinAndSelect('remito.customer', 'customer')
      .leftJoinAndSelect('remito.order', 'order')
      .leftJoinAndSelect('remito.sale', 'sale')
      .leftJoinAndSelect('remito.branch', 'branch')
      .leftJoinAndSelect('remito.issuedByUser', 'issuedByUser')
      .orderBy('remito.issuedAt', 'DESC')
      .addOrderBy('remito.createdAt', 'DESC');

    if (resolvedBranchId) {
      qb.andWhere('remito.branchId = :branchId', { branchId: resolvedBranchId });
    }

    if (filters.saleId) {
      qb.andWhere('remito.saleId = :saleId', { saleId: filters.saleId });
    }

    if (filters.orderId) {
      qb.andWhere('remito.orderId = :orderId', { orderId: filters.orderId });
    }

    if (filters.customerId) {
      qb.andWhere('remito.customerId = :customerId', {
        customerId: filters.customerId
      });
    }

    return qb.getMany();
  }

  async findOne(userScope: BranchScopedUser, id: string) {
    const remito = await this.remitoRepo.findOne({
      where: { id }
    });

    if (!remito) {
      throw new NotFoundException(`Remito ${id} not found`);
    }

    ensureBranchAccess(
      userScope,
      remito.branchId,
      'No tienes acceso a la sucursal de este remito',
      ['view_all_reports', 'view_reports']
    );

    return remito;
  }

  async findByOrderAndSourceType(
    userScope: BranchScopedUser,
    params: { orderId: string; sourceType: RemitoSourceType }
  ) {
    const remito = await this.remitoRepo.findOne({
      where: {
        orderId: params.orderId,
        sourceType: params.sourceType
      }
    });

    if (!remito) {
      throw new NotFoundException(
        `Remito ${params.sourceType} not found for order ${params.orderId}`
      );
    }

    ensureBranchAccess(
      userScope,
      remito.branchId,
      'No tienes acceso a la sucursal de este remito',
      ['view_all_reports', 'view_reports']
    );

    return remito;
  }

  async findByDeliveryEventId(userScope: BranchScopedUser, deliveryEventId: string) {
    const remito = await this.remitoRepo.findOne({
      where: { orderDeliveryEventId: deliveryEventId }
    });

    if (!remito) {
      throw new NotFoundException(
        `Remito for delivery event ${deliveryEventId} not found`
      );
    }

    ensureBranchAccess(
      userScope,
      remito.branchId,
      'No tienes acceso a la sucursal de este remito',
      ['view_all_reports', 'view_reports']
    );

    return remito;
  }

  async getPdf(userScope: BranchScopedUser, id: string) {
    const remito = await this.findOne(userScope, id);
    const pdfBuffer = await this.remitoPdfService.generate(remito);

    return {
      remito,
      pdfBuffer,
      fileName: `${(remito.remitoNumber || remito.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
    };
  }

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private resolvePaymentCondition(order: Order) {
    return Number(order.amountPaid || 0) >= Number(order.approvedTotal || order.total || 0)
      ? 'Contado'
      : 'Pendiente / CC futura';
  }

  private resolveRemitoStatus(order: Order) {
    if (order.fulfillmentStatus === OrderFulfillmentStatus.DELIVERED) {
      return RemitoStatus.DELIVERED;
    }

    if (Number(order.deliveredTotal || 0) > 0) {
      return RemitoStatus.PARTIALLY_DELIVERED;
    }

    return RemitoStatus.ISSUED;
  }

  async createOrUpdateCumulativeFromOrder(params: {
    order: Order;
    saleId?: string;
    issuedByUserId?: string;
  }) {
    const { order, saleId, issuedByUserId } = params;

    const existing = await this.remitoRepo.findOne({
      where: {
        orderId: order.id,
        sourceType: RemitoSourceType.CUMULATIVE
      }
    });

    const remito = existing || this.remitoRepo.create();

    remito.remitoNumber = order.remitoNumber;
    remito.sourceType = RemitoSourceType.CUMULATIVE;
    remito.branchId = order.branchId;
    remito.customerId = order.customerId;
    remito.orderId = order.id;
    remito.saleId = saleId;
    remito.issuedByUserId = issuedByUserId;
    remito.customerNameSnapshot =
      order.customerNameSnapshot || order.customer?.fullName || 'Cliente sin identificar';
    remito.sellerNameSnapshot =
      [order.user?.firstname, order.user?.lastname].filter(Boolean).join(' ') ||
      'Sin vendedor';
    remito.branchNameSnapshot = order.branch?.name || 'Sin sucursal';
    remito.contactSnapshot =
      order.customer?.phone || order.customer?.email || order.customer?.document || 'No informado';
    remito.paymentConditionSnapshot = this.resolvePaymentCondition(order);
    remito.status = this.resolveRemitoStatus(order);
    remito.totalOrderedAmount = this.roundCurrency(Number(order.total || 0));
    remito.totalApprovedAmount = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    remito.totalDeliveredAmount = this.roundCurrency(Number(order.deliveredTotal || 0));
    remito.totalPaidAmount = this.roundCurrency(Number(order.amountPaid || 0));
    remito.pendingPaymentAmount = this.roundCurrency(
      Math.max(
        Number(order.approvedTotal || order.total || 0) - Number(order.amountPaid || 0),
        0
      )
    );
    remito.pendingDeliveryAmount = this.roundCurrency(
      Math.max(Number(order.approvedTotal || 0) - Number(order.deliveredTotal || 0), 0)
    );
    remito.issuedAt = order.finalizedInCashAt || remito.issuedAt || new Date();
    remito.notes = order.notes;
    remito.items = (order.items || []).map((item) =>
      this.remitoItemRepo.create({
        orderItemId: item.id,
        productVariantId: item.variant?.id,
        productNameSnapshot: item.variant?.name || 'Producto',
        skuSnapshot: item.variant?.sku || undefined,
        quantityOrdered: Number(item.quantity || 0),
        quantityApproved: Number(item.approvedQuantity || 0),
        quantityDeliveredInDocument: Number(item.deliveredQuantity || 0),
        cumulativeDeliveredQuantity: Number(item.deliveredQuantity || 0),
        pendingQuantity: Math.max(
          Number(item.approvedQuantity || 0) - Number(item.deliveredQuantity || 0),
          0
        ),
        unitPrice: Number(item.price || 0),
        subtotal: this.roundCurrency(
          Number(item.deliveredQuantity || 0) * Number(item.price || 0)
        ),
        notes: item.notes
      })
    );

    if (existing) {
      await this.remitoItemRepo.delete({ remitoId: existing.id });
    }

    return this.remitoRepo.save(remito);
  }

  async createFromDeliveryEvent(params: {
    order: Order;
    deliveryEvent: OrderDeliveryEvent;
    saleId?: string;
    issuedByUserId?: string;
  }) {
    const { order, deliveryEvent, saleId, issuedByUserId } = params;

    const existing = await this.remitoRepo.findOne({
      where: { orderDeliveryEventId: deliveryEvent.id }
    });

    if (existing) {
      return existing;
    }

    const remitoNumber = `${order.remitoNumber}-E${String(
      (order.deliveryEvents || []).findIndex((event) => event.id === deliveryEvent.id) + 1
    ).padStart(2, '0')}`;

    const remito = this.remitoRepo.create({
      remitoNumber,
      sourceType: RemitoSourceType.DELIVERY_EVENT,
      branchId: order.branchId,
      customerId: order.customerId,
      orderId: order.id,
      saleId,
      orderDeliveryEventId: deliveryEvent.id,
      issuedByUserId: issuedByUserId || deliveryEvent.deliveredByUserId,
      customerNameSnapshot:
        order.customerNameSnapshot || order.customer?.fullName || 'Cliente sin identificar',
      sellerNameSnapshot:
        [order.user?.firstname, order.user?.lastname].filter(Boolean).join(' ') ||
        'Sin vendedor',
      branchNameSnapshot: order.branch?.name || 'Sin sucursal',
      contactSnapshot:
        order.customer?.phone || order.customer?.email || order.customer?.document || 'No informado',
      paymentConditionSnapshot: this.resolvePaymentCondition(order),
      status: this.resolveRemitoStatus(order),
      totalOrderedAmount: this.roundCurrency(Number(order.total || 0)),
      totalApprovedAmount: this.roundCurrency(Number(order.approvedTotal || order.total || 0)),
      totalDeliveredAmount: this.roundCurrency(
        deliveryEvent.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
      ),
      totalPaidAmount: this.roundCurrency(Number(order.amountPaid || 0)),
      pendingPaymentAmount: this.roundCurrency(
        Math.max(
          Number(order.approvedTotal || order.total || 0) - Number(order.amountPaid || 0),
          0
        )
      ),
      pendingDeliveryAmount: this.roundCurrency(
        Math.max(Number(order.approvedTotal || 0) - Number(order.deliveredTotal || 0), 0)
      ),
      issuedAt: deliveryEvent.createdAt || new Date(),
      notes: deliveryEvent.notes,
      items: (deliveryEvent.items || []).map((item) =>
        this.remitoItemRepo.create({
          orderItemId: item.orderItemId,
          productVariantId: item.orderItem?.variant?.id,
          productNameSnapshot: item.variantName || 'Producto',
          skuSnapshot: item.variantSku || undefined,
          quantityOrdered: Number(item.orderItem?.quantity || 0),
          quantityApproved: Number(item.orderItem?.approvedQuantity || 0),
          quantityDeliveredInDocument: Number(item.deliveredQuantity || 0),
          cumulativeDeliveredQuantity: Number(item.cumulativeDeliveredQuantity || 0),
          pendingQuantity: Number(item.pendingQuantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          subtotal: this.roundCurrency(Number(item.subtotal || 0)),
          notes: item.notes
        })
      )
    });

    return this.remitoRepo.save(remito);
  }
}
