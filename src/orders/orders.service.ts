import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus
} from './entities/order.entity';
import { OrderItem, OrderItemStatus } from './entities/order-item.entity';
import { OrderDeliveryEvent } from './entities/order-delivery-event.entity';
import { OrderDeliveryEventItem } from './entities/order-delivery-event-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  ReviewOrderDto,
  ReviewedOrderItemStatusDto
} from './dto/review-order.dto';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import { StockService } from 'src/stock/stock.service';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { User } from 'src/users/entities/user.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ScopedUser = BranchScopedUser;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderDeliveryEvent)
    private readonly deliveryEventRepo: Repository<OrderDeliveryEvent>,
    @InjectRepository(OrderDeliveryEventItem)
    private readonly deliveryEventItemRepo: Repository<OrderDeliveryEventItem>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    private readonly stockService: StockService
  ) {}

  private async generateRemitoNumber() {
    while (true) {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const candidate = `REM-${timestamp}-${random}`;
      const exists = await this.orderRepo.findOne({
        where: { remitoNumber: candidate }
      });
      if (!exists) {
        return candidate;
      }
    }
  }

  async create(userScope: ScopedUser, dto: CreateOrderDto) {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    const customer = dto.customerId
      ? await this.customerRepo.findOne({
          where: { id: dto.customerId, isActive: true }
        })
      : null;

    if (dto.customerId && !customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    const customerName =
      dto.customerNameSnapshot?.trim() || customer?.fullName?.trim();
    if (!customerName) {
      throw new BadRequestException(
        'Debes indicar un cliente para generar el remito'
      );
    }

    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: dto.branchId,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para la venta',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta venta'
    });

    const branch = await this.branchRepo.findOne({
      where: { id: resolvedBranchId, isActive: true }
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${resolvedBranchId} not found`);
    }

    let availableStockMap = new Map<string, number>();

    if (branch.restrictSalesToBranchStock) {
      availableStockMap = await this.stockService.getBranchAvailableStockMap(
        dto.items.map((item) => item.variantId).filter(Boolean),
        resolvedBranchId
      );
    }

    const items: OrderItem[] = [];
    let total = 0;

    for (const item of dto.items) {
      const variant = await this.variantRepo.findOne({
        where: { id: item.variantId }
      });
      if (!variant)
        throw new NotFoundException(`Variant ${item.variantId} not found`);

      if (branch.restrictSalesToBranchStock) {
        const branchAvailableQuantity = Number(
          availableStockMap.get(item.variantId) || 0
        );

        if (Number(item.quantity || 0) > branchAvailableQuantity) {
          throw new BadRequestException(
            `La sucursal ${branch.name} solo dispone de ${branchAvailableQuantity} unidad(es) para ${variant.name}`
          );
        }
      }

      const subtotal = item.price * item.quantity;
      total += subtotal;

      const orderItem = this.itemRepo.create({
        variant,
        quantity: item.quantity,
        approvedQuantity: 0,
        reservedQuantity: 0,
        deliveredQuantity: 0,
        status: OrderItemStatus.PENDING,
        price: item.price,
        subtotal,
        notes: undefined
      });

      items.push(orderItem);
    }

    const order = this.orderRepo.create({
      remitoNumber: await this.generateRemitoNumber(),
      user,
      items,
      branchId: resolvedBranchId,
      customerId: customer?.id,
      customer: customer ?? undefined,
      customerNameSnapshot: customerName,
      notes: dto.notes?.trim() || undefined,
      total,
      approvedTotal: 0,
      deliveredTotal: 0,
      status: OrderStatus.DRAFT,
      paymentStatus: OrderPaymentStatus.UNPAID,
      fulfillmentStatus: OrderFulfillmentStatus.PENDING
    });

    const savedOrder: Order = await this.orderRepo.save(order);
    return this.findOne(userScope, savedOrder.id);
  }

  findAll(userScope: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para la venta',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta venta'
    });

    return this.orderRepo.find({
      where: resolvedBranchId ? { branchId: resolvedBranchId } : {},
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(userScope: ScopedUser, id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    ensureBranchAccess(
      userScope,
      order.branchId,
      'No tienes acceso a la sucursal de esta venta'
    );

    return order;
  }

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private buildStockExceededMessage(
    productName: string,
    requestedQuantity: number,
    availableNow: number,
    pendingAfter: number
  ) {
    return `No hay stock suficiente para ${productName}. Se quiso entregar ${requestedQuantity} unidad(es), pero solo hay ${availableNow} disponible(s) para entregar ahora. Quedan ${pendingAfter} unidad(es) pendiente(s) sin stock.`;
  }

  private async isStrictStockBranch(branchId?: string | null) {
    if (!branchId) {
      return false;
    }

    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      select: {
        id: true,
        restrictSalesToBranchStock: true
      }
    });

    return Boolean(branch?.restrictSalesToBranchStock);
  }

  async update(userScope: ScopedUser, id: string, dto: UpdateOrderDto) {
    await this.findOne(userScope, id);
    await this.orderRepo.update(id, dto);
    return this.findOne(userScope, id);
  }

  saveOrderState(order: Order) {
    return this.orderRepo.save(order);
  }

  async remove(userScope: ScopedUser, id: string) {
    const order = await this.findOne(userScope, id);
    return this.orderRepo.remove(order);
  }

  async sendToCash(userScope: ScopedUser, id: string) {
    const order = await this.findOne(userScope, id);

    if (!order.items?.length) {
      throw new BadRequestException('El remito no tiene ítems');
    }

    if (
      ![
        OrderStatus.PENDING,
        OrderStatus.DRAFT,
        OrderStatus.SENT_TO_CASH
      ].includes(order.status)
    ) {
      throw new BadRequestException(
        'Solo se pueden enviar a caja remitos en borrador'
      );
    }

    order.status = OrderStatus.SENT_TO_CASH;
    order.submittedAt = new Date();
    return this.orderRepo.save(order);
  }

  async getCashQueue(userScope: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para caja',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta caja'
    });

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.branch', 'branch')
      .where('order.status IN (:...statuses)', {
        statuses: [
          OrderStatus.SENT_TO_CASH,
          OrderStatus.PARTIALLY_APPROVED,
          OrderStatus.APPROVED
        ]
      })
      .andWhere('order.finalizedInCashAt IS NULL')
      .orderBy('order.createdAt', 'ASC');

    if (resolvedBranchId) {
      qb.andWhere('order.branchId = :branchId', { branchId: resolvedBranchId });
    }

    const orders = await qb.getMany();
    const variantIds = orders.flatMap((order) =>
      order.items.map((item) => item.variant?.id).filter(Boolean)
    );
    const availableStockMap =
      await this.stockService.getBranchAvailableStockMap(
        variantIds,
        resolvedBranchId
      );

    return orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        availableQuantity: availableStockMap.get(item.variant?.id) ?? 0
      }))
    }));
  }

  async getPendingDeliveries(userScope: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para entregas pendientes',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta caja'
    });

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.branch', 'branch')
      .where('order.finalizedInCashAt IS NOT NULL')
      .andWhere('order.fulfillmentStatus IN (:...fulfillmentStatuses)', {
        fulfillmentStatuses: [
          OrderFulfillmentStatus.PENDING,
          OrderFulfillmentStatus.PARTIALLY_DELIVERED,
          OrderFulfillmentStatus.PENDING_STOCK
        ]
      })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.PARTIALLY_APPROVED, OrderStatus.APPROVED]
      })
      .orderBy('order.updatedAt', 'ASC');

    if (resolvedBranchId) {
      qb.andWhere('order.branchId = :branchId', { branchId: resolvedBranchId });
    }

    return qb.getMany();
  }

  async reviewInCash(userScope: ScopedUser, id: string, dto: ReviewOrderDto) {
    const order = await this.findOne(userScope, id);
    const strictStockBranch = await this.isStrictStockBranch(order.branchId);

    if (
      ![
        OrderStatus.SENT_TO_CASH,
        OrderStatus.PARTIALLY_APPROVED,
        OrderStatus.APPROVED
      ].includes(order.status)
    ) {
      throw new BadRequestException(
        'El remito no está disponible para revisión en caja'
      );
    }

    if (dto.rejectEntireOrder) {
      for (const item of order.items) {
        const reservedQuantity = Number(item.reservedQuantity || 0);
        if (reservedQuantity > 0) {
          await this.stockService.releaseReservedStock(
            item.variant.id,
            order.branchId,
            order.user.id,
            reservedQuantity,
            `Liberación por rechazo remito ${order.remitoNumber}`
          );
        }
      }

      order.status = OrderStatus.REJECTED;
      order.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      order.reviewedAt = new Date();
      if (dto.notes?.trim()) {
        order.notes = [order.notes, dto.notes.trim()]
          .filter(Boolean)
          .join('\n');
      }
      order.items = order.items.map(
        (item) =>
          ({
            ...item,
            approvedQuantity: 0,
            reservedQuantity: 0,
            status: OrderItemStatus.REJECTED
          }) as OrderItem
      );
      order.approvedTotal = 0;
      return this.orderRepo.save(order);
    }

    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    const availableStockMap =
      await this.stockService.getBranchAvailableStockMap(
        order.items.map((item) => item.variant?.id).filter(Boolean),
        order.branchId
      );
    let approvedTotal = 0;
    let hasApproved = false;
    let hasPendingStock = false;

    for (const reviewedItem of dto.items) {
      const existingItem = itemMap.get(reviewedItem.itemId);
      if (!existingItem) {
        throw new NotFoundException(
          `Order item ${reviewedItem.itemId} not found`
        );
      }

      if (reviewedItem.approvedQuantity > existingItem.quantity) {
        throw new BadRequestException(
          `La cantidad aprobada no puede superar la cantidad pedida de ${existingItem.variant?.name}`
        );
      }

      const previousReservedQuantity = Number(
        existingItem.reservedQuantity || 0
      );
      const requestedApprovedQuantity = Number(
        reviewedItem.approvedQuantity || 0
      );
      const branchAvailableQuantity = Number(
        availableStockMap.get(existingItem.variant.id) || 0
      );
      const maxReservableQuantity =
        previousReservedQuantity + branchAvailableQuantity;
      let desiredReservedQuantity =
        reviewedItem.decision === ReviewedOrderItemStatusDto.REJECTED
          ? 0
          : Math.min(requestedApprovedQuantity, maxReservableQuantity);

      if (
        reviewedItem.decision ===
        ReviewedOrderItemStatusDto.APPROVED_PENDING_STOCK
      ) {
        if (strictStockBranch) {
          throw new BadRequestException(
            'En sucursales con stock estricto no se permiten remitos pendientes por stock desde caja'
          );
        }

        desiredReservedQuantity = Math.min(
          requestedApprovedQuantity,
          maxReservableQuantity
        );
      }

      if (
        reviewedItem.decision === ReviewedOrderItemStatusDto.APPROVED &&
        desiredReservedQuantity < requestedApprovedQuantity
      ) {
        if (strictStockBranch) {
          throw new BadRequestException(
            this.buildStockExceededMessage(
              existingItem.variant?.name || 'Producto',
              requestedApprovedQuantity,
              maxReservableQuantity,
              Math.max(
                requestedApprovedQuantity - maxReservableQuantity,
                0
              )
            )
          );
        }

        hasPendingStock = true;
      }

      const reservationDelta =
        desiredReservedQuantity - previousReservedQuantity;

      if (reservationDelta > 0) {
        try {
          await this.stockService.reserveStock(
            existingItem.variant.id,
            order.branchId,
            order.user.id,
            reservationDelta,
            `Reserva remito ${order.remitoNumber}`
          );
        } catch (stockError: any) {
          const stockMessage =
            stockError?.response?.message || stockError?.message || '';
          if (
            stockError instanceof BadRequestException &&
            String(stockMessage).includes('Not enough stock')
          ) {
            desiredReservedQuantity =
              previousReservedQuantity + Math.max(branchAvailableQuantity, 0);
            hasPendingStock = true;
          } else {
            throw stockError;
          }
        }
      } else if (reservationDelta < 0) {
        await this.stockService.releaseReservedStock(
          existingItem.variant.id,
          order.branchId,
          order.user.id,
          Math.abs(reservationDelta),
          `Ajuste reserva remito ${order.remitoNumber}`
        );
      }

      availableStockMap.set(
        existingItem.variant.id,
        Math.max(
          branchAvailableQuantity -
            Math.max(desiredReservedQuantity - previousReservedQuantity, 0),
          0
        )
      );

      existingItem.approvedQuantity = requestedApprovedQuantity;
      existingItem.reservedQuantity = desiredReservedQuantity;
      existingItem.notes = reviewedItem.notes?.trim() || existingItem.notes;

      if (
        reviewedItem.decision === ReviewedOrderItemStatusDto.REJECTED ||
        reviewedItem.approvedQuantity === 0
      ) {
        existingItem.status = OrderItemStatus.REJECTED;
      } else if (
        reviewedItem.decision ===
          ReviewedOrderItemStatusDto.APPROVED_PENDING_STOCK ||
        desiredReservedQuantity < requestedApprovedQuantity
      ) {
        existingItem.status = OrderItemStatus.APPROVED_PENDING_STOCK;
        hasApproved = true;
        hasPendingStock = true;
      } else {
        existingItem.status = OrderItemStatus.RESERVED;
        hasApproved = true;
      }

      approvedTotal +=
        Number(existingItem.price || 0) *
        Number(existingItem.approvedQuantity || 0);
    }

    order.approvedTotal = approvedTotal;
    order.reviewedAt = new Date();
    if (dto.notes?.trim()) {
      order.notes = [order.notes, dto.notes.trim()].filter(Boolean).join('\n');
    }

    if (!hasApproved) {
      order.status = OrderStatus.REJECTED;
      order.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
    } else if (hasPendingStock) {
      order.status = OrderStatus.PARTIALLY_APPROVED;
      order.fulfillmentStatus = OrderFulfillmentStatus.PENDING_STOCK;
    } else {
      const allApproved = order.items.every(
        (item) => item.status === OrderItemStatus.RESERVED
      );
      order.status = allApproved
        ? OrderStatus.APPROVED
        : OrderStatus.PARTIALLY_APPROVED;
      order.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
    }

    return this.orderRepo.save(order);
  }

  async deliverInCash(userScope: ScopedUser, id: string, dto: DeliverOrderDto) {
    const order = await this.findOne(userScope, id);
    const strictStockBranch = await this.isStrictStockBranch(order.branchId);

    if (
      ![OrderStatus.APPROVED, OrderStatus.PARTIALLY_APPROVED].includes(
        order.status
      )
    ) {
      throw new BadRequestException(
        'Solo se pueden entregar remitos aprobados'
      );
    }

    if (!dto.items?.length) {
      throw new BadRequestException(
        'Debes indicar al menos un ítem para registrar la entrega'
      );
    }

    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    const deliveryEventItems: OrderDeliveryEventItem[] = [];
    let deliveredTotal = 0;
    let hasDelivered = false;
    let hasPendingStock = false;

    for (const deliveredItem of dto.items) {
      const existingItem = itemMap.get(deliveredItem.itemId);
      if (!existingItem) {
        throw new NotFoundException(
          `Order item ${deliveredItem.itemId} not found`
        );
      }

      const currentDeliveredQuantity = Number(
        existingItem.deliveredQuantity || 0
      );
      const approvedQuantity = Number(existingItem.approvedQuantity || 0);

      if (deliveredItem.deliveredQuantity < currentDeliveredQuantity) {
        throw new BadRequestException(
          `La cantidad entregada no puede ser menor a la ya registrada de ${existingItem.variant?.name}`
        );
      }

      if (deliveredItem.deliveredQuantity > approvedQuantity) {
        throw new BadRequestException(
          `La cantidad entregada no puede superar la aprobada de ${existingItem.variant?.name}`
        );
      }

      if (
        strictStockBranch &&
        deliveredItem.deliveredQuantity !== approvedQuantity
      ) {
        throw new BadRequestException(
          `En sucursales con stock estricto, la cantidad entregada debe coincidir con la aprobada de ${existingItem.variant?.name}`
        );
      }

      const quantityDelta =
        deliveredItem.deliveredQuantity - currentDeliveredQuantity;
      const availableNow = Math.max(
        Math.min(
          Number(existingItem.reservedQuantity || 0),
          approvedQuantity - currentDeliveredQuantity
        ),
        0
      );
      const pendingAfter = Math.max(
        approvedQuantity -
          (currentDeliveredQuantity + Math.min(quantityDelta, availableNow)),
        0
      );

      if (quantityDelta > availableNow) {
        throw new BadRequestException(
          this.buildStockExceededMessage(
            existingItem.variant?.name || 'Producto',
            quantityDelta,
            availableNow,
            pendingAfter
          )
        );
      }

      if (quantityDelta > 0) {
        try {
          await this.stockService.consumeReservedStock(
            existingItem.variant.id,
            order.branchId,
            order.user.id,
            quantityDelta,
            `Entrega remito ${order.remitoNumber}`
          );
        } catch (stockError: any) {
          const stockMessage =
            stockError?.response?.message || stockError?.message || '';
          if (
            stockError instanceof BadRequestException &&
            (String(stockMessage).includes('Not enough stock') ||
              String(stockMessage).includes('Reserved stock insufficient') ||
              String(stockMessage).includes('Physical stock insufficient'))
          ) {
            throw new BadRequestException(
              this.buildStockExceededMessage(
                existingItem.variant?.name || 'Producto',
                quantityDelta,
                availableNow,
                pendingAfter
              )
            );
          }
          throw stockError;
        }
      }

      existingItem.deliveredQuantity = deliveredItem.deliveredQuantity;
      existingItem.reservedQuantity = Math.max(
        Number(existingItem.reservedQuantity || 0) - Math.max(quantityDelta, 0),
        0
      );
      existingItem.status =
        deliveredItem.deliveredQuantity >= existingItem.approvedQuantity &&
        existingItem.approvedQuantity > 0
          ? OrderItemStatus.DELIVERED
          : existingItem.approvedQuantity > deliveredItem.deliveredQuantity
            ? OrderItemStatus.APPROVED_PENDING_STOCK
            : existingItem.status;
      deliveredTotal +=
        Number(existingItem.price || 0) *
        Number(existingItem.deliveredQuantity || 0);
      hasDelivered = hasDelivered || deliveredItem.deliveredQuantity > 0;
      hasPendingStock =
        hasPendingStock ||
        existingItem.approvedQuantity > deliveredItem.deliveredQuantity;

      if (quantityDelta > 0) {
        deliveryEventItems.push(
          this.deliveryEventItemRepo.create({
            orderItemId: existingItem.id,
            orderItem: existingItem,
            deliveredQuantity: quantityDelta,
            cumulativeDeliveredQuantity: Number(
              existingItem.deliveredQuantity || 0
            ),
            pendingQuantity: Math.max(
              Number(existingItem.approvedQuantity || 0) -
                Number(existingItem.deliveredQuantity || 0),
              0
            ),
            variantName: existingItem.variant?.name || 'Producto',
            variantSku: existingItem.variant?.sku || undefined,
            unitPrice: Number(existingItem.price || 0),
            subtotal: this.roundCurrency(
              quantityDelta * Number(existingItem.price || 0)
            ),
            notes: existingItem.notes
          })
        );
      }
    }

    order.deliveredTotal = deliveredTotal;
    order.deliveredAt = hasDelivered ? new Date() : order.deliveredAt;

    const fullyDelivered = order.items.every(
      (item) => item.approvedQuantity === item.deliveredQuantity
    );
    const anyDelivered = order.items.some(
      (item) => Number(item.deliveredQuantity || 0) > 0
    );

    if (fullyDelivered && anyDelivered) {
      order.fulfillmentStatus = OrderFulfillmentStatus.DELIVERED;
      order.status = OrderStatus.APPROVED;
    } else if (hasPendingStock && !anyDelivered) {
      order.fulfillmentStatus = OrderFulfillmentStatus.PENDING_STOCK;
      order.status = OrderStatus.PARTIALLY_APPROVED;
    } else if (hasPendingStock) {
      order.fulfillmentStatus = OrderFulfillmentStatus.PARTIALLY_DELIVERED;
      order.status = OrderStatus.PARTIALLY_APPROVED;
    } else if (anyDelivered) {
      order.fulfillmentStatus = OrderFulfillmentStatus.PARTIALLY_DELIVERED;
      order.status = OrderStatus.PARTIALLY_APPROVED;
    }

    if (dto.notes?.trim()) {
      order.notes = [order.notes, dto.notes.trim()].filter(Boolean).join('\n');
    }

    if (
      order.paymentStatus === OrderPaymentStatus.PAID &&
      order.fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
    ) {
      order.status = OrderStatus.COMPLETED;
      order.completedAt = new Date();
    }

    const savedOrder = await this.orderRepo.save(order);

    if (deliveryEventItems.length > 0) {
      const deliveryEvent = await this.deliveryEventRepo.save(
        this.deliveryEventRepo.create({
          orderId: savedOrder.id,
          order: savedOrder,
          deliveredByUserId: userScope.userId,
          notes: dto.notes?.trim() || undefined
        })
      );

      await this.deliveryEventItemRepo.save(
        deliveryEventItems.map((item) =>
          this.deliveryEventItemRepo.create({
            deliveryEventId: deliveryEvent.id,
            deliveryEvent,
            orderItemId: item.orderItemId,
            orderItem: item.orderItem,
            deliveredQuantity: item.deliveredQuantity,
            cumulativeDeliveredQuantity: item.cumulativeDeliveredQuantity,
            pendingQuantity: item.pendingQuantity,
            variantName: item.variantName,
            variantSku: item.variantSku,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            notes: item.notes
          })
        )
      );
    }

    return this.findOne(userScope, savedOrder.id);
  }

  async getSellerMetrics(
    userScope: ScopedUser,
    sellerUserId?: string,
    branchId?: string
  ) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para ventas',
      forbiddenMessage: 'No tienes acceso a la sucursal de estas ventas'
    });

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .where('order.paymentStatus = :paymentStatus', {
        paymentStatus: OrderPaymentStatus.PAID
      })
      .andWhere('order.fulfillmentStatus = :fulfillmentStatus', {
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED
      });

    if (resolvedBranchId) {
      qb.andWhere('order.branchId = :branchId', { branchId: resolvedBranchId });
    }

    if (sellerUserId) {
      qb.andWhere('user.id = :sellerUserId', { sellerUserId });
    }

    const orders = await qb.getMany();

    const summary = orders.reduce(
      (acc, order) => {
        const key = order.user?.id || 'unknown';
        const sellerName =
          [order.user?.firstname, order.user?.lastname]
            .filter(Boolean)
            .join(' ') || 'Sin vendedor';
        const deliveredTotal = Number(order.deliveredTotal || 0);

        if (!acc[key]) {
          acc[key] = {
            sellerUserId: order.user?.id,
            sellerName,
            totalOrders: 0,
            totalAmount: 0,
            orders: []
          };
        }

        acc[key].totalOrders += 1;
        acc[key].totalAmount += deliveredTotal;
        acc[key].orders.push({
          orderId: order.id,
          customerName:
            order.customerNameSnapshot ||
            order.customer?.fullName ||
            'Sin cliente',
          totalAmount: deliveredTotal,
          completedAt: order.completedAt || order.deliveredAt || order.updatedAt
        });

        return acc;
      },
      {} as Record<string, any>
    );

    return Object.values(summary);
  }
}
