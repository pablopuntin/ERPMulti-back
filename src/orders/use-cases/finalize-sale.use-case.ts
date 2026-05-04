import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from 'src/branches/entities/branch.entity';
import { OperationAttempt, OperationAttemptStatus } from 'src/common/entities/operation-attempt.entity';
import { BranchScopedUser } from 'src/common/auth/branch-scope.util';
import { AccountLedgerService } from 'src/account/services/account-ledger.service';
import { PaymentsService } from 'src/payments/payments.service';
import { SalesService } from 'src/sales/sales.service';
import { RemitoSourceType } from 'src/remitos/entities/remito.entity';
import { RemitosService } from 'src/remitos/remitos.service';
import { DeliverOrderDto } from '../dto/deliver-order.dto';
import { FinalizeOrderDto } from '../dto/finalize-order.dto';
import { ReviewOrderDto, ReviewedOrderItemStatusDto } from '../dto/review-order.dto';
import { OrderDeliveryEvent } from '../entities/order-delivery-event.entity';
import { OrderFulfillmentStatus, OrderPaymentStatus, OrderStatus } from '../entities/order.entity';
import { OrderItemStatus } from '../entities/order-item.entity';
import { OrdersService } from '../orders.service';

@Injectable()
export class FinalizeSaleUseCase {
  constructor(
    @InjectRepository(OperationAttempt)
    private readonly operationAttemptRepo: Repository<OperationAttempt>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly accountLedgerService: AccountLedgerService,
    private readonly salesService: SalesService,
    private readonly remitosService: RemitosService
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private buildFinalizeOperationKey(orderId: string, dto: FinalizeOrderDto) {
    return dto.operationId?.trim() || `finalize_order:${orderId}`;
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

  private async startFinalizeAttempt(
    userScope: BranchScopedUser,
    orderId: string,
    branchId: string | undefined,
    dto: FinalizeOrderDto
  ) {
    const operationKey = this.buildFinalizeOperationKey(orderId, dto);
    const existing = await this.operationAttemptRepo.findOne({
      where: { operationKey }
    });

    if (existing) {
      if (
        existing.status === OperationAttemptStatus.COMMITTED ||
        existing.status === OperationAttemptStatus.PDF_FAILED
      ) {
        return { attempt: existing, alreadyCommitted: true };
      }

      if (existing.status === OperationAttemptStatus.STARTED) {
        throw new BadRequestException(
          'La finalización de este remito ya está en proceso. Esperá unos segundos antes de reintentar.'
        );
      }
    }

    const attempt = this.operationAttemptRepo.create({
      operationType: 'orders.finalizeInCash',
      operationKey,
      branchId,
      userId: userScope.userId,
      orderId,
      requestHash: JSON.stringify(dto),
      status: OperationAttemptStatus.STARTED
    });

    return {
      attempt: await this.operationAttemptRepo.save(attempt),
      alreadyCommitted: false
    };
  }

  private async safeBuildFinalizePdfResponse(
    userScope: BranchScopedUser,
    result: any,
    attempt: OperationAttempt
  ) {
    try {
      const { pdfBuffer, fileName } = await this.remitosService.getPdf(
        userScope,
        result.remitoId
      );

      await this.operationAttemptRepo.update(attempt.id, {
        status: OperationAttemptStatus.COMMITTED,
        resultSnapshot: JSON.parse(JSON.stringify({
          orderId: result.order?.id,
          saleId: result.sale?.id,
          remitoId: result.remitoId,
          paymentRegistered: result.paymentRegistered,
          pdfGenerated: true
        }))
      });

      return {
        ...result,
        operationId: attempt.id,
        pdfGenerated: true,
        pdfBase64: pdfBuffer.toString('base64'),
        pdfFileName: fileName
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'No se pudo generar el PDF del remito';

      await this.operationAttemptRepo.update(attempt.id, {
        status: OperationAttemptStatus.PDF_FAILED,
        errorMessage,
        resultSnapshot: JSON.parse(JSON.stringify({
          orderId: result.order?.id,
          saleId: result.sale?.id,
          remitoId: result.remitoId,
          paymentRegistered: result.paymentRegistered,
          pdfGenerated: false
        }))
      });

      return {
        ...result,
        operationId: attempt.id,
        pdfGenerated: false,
        pdfError:
          'La venta fue finalizada, pero no se pudo generar el PDF. Reintentá la impresión desde el remito.'
      };
    }
  }

  async execute(userScope: BranchScopedUser, id: string, dto: FinalizeOrderDto) {
    const order = await this.ordersService.findOne(userScope, id);
    const { attempt, alreadyCommitted } = await this.startFinalizeAttempt(
      userScope,
      order.id,
      order.branchId,
      dto
    );

    if (alreadyCommitted) {
      return {
        operationId: attempt.id,
        alreadyProcessed: true,
        pdfGenerated: attempt.status === OperationAttemptStatus.COMMITTED,
        pdfError:
          attempt.status === OperationAttemptStatus.PDF_FAILED
            ? 'La venta ya fue finalizada, pero el PDF había fallado. Reintentá la impresión desde el remito.'
            : undefined,
        ...attempt.resultSnapshot
      };
    }

    try {
      const strictStockBranch = await this.isStrictStockBranch(order.branchId);
      const paymentMethod = dto.payment?.method?.trim() || 'cash';
      const isCurrentAccount = paymentMethod === 'current_account';

      if (
        ![
          OrderStatus.SENT_TO_CASH,
          OrderStatus.PARTIALLY_APPROVED,
          OrderStatus.APPROVED,
          OrderStatus.COMPLETED
        ].includes(order.status)
      ) {
        throw new BadRequestException(
          'El remito no está disponible para finalizar en caja'
        );
      }

      if (!dto.items?.length) {
        throw new BadRequestException(
          'Debes indicar los ítems del remito para finalizar'
        );
      }

      if (
        strictStockBranch &&
        dto.items.some(
          (item) =>
            Number(item.approvedQuantity || 0) !==
            Number(item.deliveredQuantity || 0)
        )
      ) {
        throw new BadRequestException(
          'En sucursales con stock estricto, la cantidad entregada debe coincidir con la aprobada'
        );
      }

      if (
        strictStockBranch &&
        dto.items.some(
          (item) =>
            item.decision === ReviewedOrderItemStatusDto.APPROVED_PENDING_STOCK
        )
      ) {
        throw new BadRequestException(
          'En sucursales con stock estricto no se permiten remitos pendientes por stock desde caja'
        );
      }

      const hasReviewChanges = dto.items.some((item) => {
        const existing = order.items.find(
          (orderItem) => orderItem.id === item.itemId
        );
        return (
          Number(existing?.approvedQuantity || 0) !==
            Number(item.approvedQuantity || 0) ||
          (item.decision &&
            item.decision !== ReviewedOrderItemStatusDto.APPROVED &&
            existing?.status !== OrderItemStatus.APPROVED_PENDING_STOCK) ||
          (!item.decision &&
            existing?.status === OrderItemStatus.APPROVED_PENDING_STOCK &&
            Number(item.approvedQuantity || 0) > 0)
        );
      });

      const beforeDeliveryDelivered = order.items.reduce(
        (sum, item) => sum + Number(item.deliveredQuantity || 0),
        0
      );
      const targetDeliveryDelivered = dto.items.reduce(
        (sum, item) =>
          sum +
          Number(
            strictStockBranch ? item.approvedQuantity || 0 : item.deliveredQuantity || 0
          ),
        0
      );
      const hasDeliveryChanges = beforeDeliveryDelivered !== targetDeliveryDelivered;
      const hasPendingItems = dto.items.some(
        (item) => Number(item.approvedQuantity || 0) > Number(item.deliveredQuantity || 0)
      );

      if (order.status === OrderStatus.COMPLETED) {
        if ((dto.payment?.amount || 0) > 0) {
          throw new BadRequestException(
            'El remito ya está pago y completado. No se puede registrar un nuevo cobro'
          );
        }

        if (!hasReviewChanges && !hasDeliveryChanges && !dto.forceReprint) {
          throw new BadRequestException(
            'No hubo cambios en el remito. Indica reimpresión para emitirlo nuevamente'
          );
        }

        order.finalizedInCashAt = order.finalizedInCashAt || new Date();
        await this.ordersService.saveOrderState(order);

        await this.remitosService.createOrUpdateCumulativeFromOrder({
          order,
          saleId: order.convertedSaleId,
          issuedByUserId: userScope.userId
        });
        const remitoForPdf = await this.remitosService.findByOrderAndSourceType(
          userScope,
          {
            orderId: order.id,
            sourceType: RemitoSourceType.CUMULATIVE
          }
        );
        return this.safeBuildFinalizePdfResponse(
          userScope,
          {
            order,
            paymentRegistered: false,
            pdfType: 'cumulative',
            remitoId: remitoForPdf.id
          },
          attempt
        );
      }

      const reviewPayload: ReviewOrderDto = {
        items: dto.items.map((item) => ({
          itemId: item.itemId,
          decision:
            item.decision ||
            (item.approvedQuantity > 0
              ? ReviewedOrderItemStatusDto.APPROVED
              : ReviewedOrderItemStatusDto.REJECTED),
          approvedQuantity: item.approvedQuantity,
          notes: item.notes
        })),
        notes: dto.notes
      };

      const reviewedOrder = await this.ordersService.reviewInCash(
        userScope,
        id,
        reviewPayload
      );

      if (hasPendingItems && !isCurrentAccount) {
        const pendingAmountAfterReview = this.roundCurrency(
          Math.max(
            Number(reviewedOrder.approvedTotal || reviewedOrder.total || 0) -
              Number(reviewedOrder.amountPaid || 0),
            0
          )
        );
        const requestedPaymentAmount = this.roundCurrency(
          Number(dto.payment?.amount || 0)
        );

        if (this.roundCurrency(requestedPaymentAmount - pendingAmountAfterReview) !== 0) {
          throw new BadRequestException(
            `La venta tiene productos pendientes de entrega. Debes registrar el pago total para finalizar. Pendiente actual: ${pendingAmountAfterReview}`
          );
        }
      }

      const paymentRegistered = await this.paymentsService.registerForOrderFinalization(
        userScope,
        reviewedOrder,
        dto
      );

      const deliverPayload: DeliverOrderDto = {
        items: dto.items.map((item) => ({
          itemId: item.itemId,
          deliveredQuantity: strictStockBranch
            ? Number(
                reviewedOrder.items.find(
                  (reviewedItem) => reviewedItem.id === item.itemId
                )?.approvedQuantity || 0
              )
            : item.deliveredQuantity
        })),
        notes: dto.notes
      };

      let finalOrder = reviewedOrder;
      let latestDeliveryEvent: OrderDeliveryEvent | null = null;
      if (hasDeliveryChanges) {
        finalOrder = await this.ordersService.deliverInCash(userScope, id, deliverPayload);
        latestDeliveryEvent =
          (finalOrder.deliveryEvents || [])
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0] || null;
      }

      if (
        !paymentRegistered &&
        !hasDeliveryChanges &&
        !hasReviewChanges &&
        !dto.forceReprint
      ) {
        throw new BadRequestException(
          'No hubo cambios en el remito. Indica reimpresión para emitirlo nuevamente'
        );
      }

      finalOrder.finalizedInCashAt = new Date();
      finalOrder.paymentStatus = this.paymentsService.resolveOrderPaymentStatus(finalOrder);
      await this.ordersService.saveOrderState(finalOrder);

      if (
        finalOrder.paymentStatus === OrderPaymentStatus.PAID &&
        finalOrder.fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
      ) {
        finalOrder.status = OrderStatus.COMPLETED;
        finalOrder.completedAt = new Date();
        await this.ordersService.saveOrderState(finalOrder);
      }

      await this.accountLedgerService.syncOrderDebt({
        order: finalOrder,
        userId: dto.payment?.paidByUserId || userScope.userId,
        notes: dto.notes
      });

      const sale = await this.salesService.createFromOrder({
        order: finalOrder,
        cashierUserId: dto.payment?.paidByUserId || userScope.userId,
        createdByUserId: userScope.userId
      });

      if (!finalOrder.convertedSaleId) {
        finalOrder.convertedSaleId = sale.id;
        finalOrder.convertedToSaleAt = new Date();
        await this.ordersService.saveOrderState(finalOrder);
      }

      await this.remitosService.createOrUpdateCumulativeFromOrder({
        order: finalOrder,
        saleId: sale.id,
        issuedByUserId: userScope.userId
      });

      if (latestDeliveryEvent) {
        await this.remitosService.createFromDeliveryEvent({
          order: finalOrder,
          deliveryEvent: latestDeliveryEvent,
          saleId: sale.id,
          issuedByUserId: userScope.userId
        });
      }

      const refreshedOrder = await this.ordersService.findOne(userScope, id);
      const remitoForPdf = latestDeliveryEvent
        ? await this.remitosService.findByDeliveryEventId(
            userScope,
            latestDeliveryEvent.id
          )
        : await this.remitosService.findByOrderAndSourceType(userScope, {
            orderId: refreshedOrder.id,
            sourceType: RemitoSourceType.CUMULATIVE
          });
      return this.safeBuildFinalizePdfResponse(
        userScope,
        {
          order: refreshedOrder,
          sale,
          paymentRegistered,
          pdfType: latestDeliveryEvent ? 'delivery_event' : 'cumulative',
          deliveryEventId: latestDeliveryEvent?.id,
          remitoId: remitoForPdf.id
        },
        attempt
      );
    } catch (error) {
      await this.operationAttemptRepo.update(attempt.id, {
        status: OperationAttemptStatus.FAILED_ROLLED_BACK,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'No se pudo finalizar el remito'
      });
      throw error;
    }
  }
}
