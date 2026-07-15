//MODULO PARA UN FUTURO ECOMMERCE
import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus
} from '../orders/entities/order.entity';
import { CashMovement } from 'src/cash/entities/cash-movement.entity';
import { CashMovementType } from '../cash/entities/cash-movement.entity';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import { AccountLedgerService } from 'src/account/services/account-ledger.service';
import { CashService } from 'src/cash/cash.service';

type ScopedUser = BranchScopedUser;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private accountLedgerService: AccountLedgerService,
    private cashService: CashService
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private resolveNextPaymentStatus(order: Order, paymentIncrement = 0) {
    const orderTotal = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    const totalPaid = this.roundCurrency(
      Number(order.amountPaid || 0) + Number(paymentIncrement || 0)
    );

    if (totalPaid <= 0) {
      return OrderPaymentStatus.UNPAID;
    }

    if (totalPaid >= orderTotal) {
      return OrderPaymentStatus.PAID;
    }

    return OrderPaymentStatus.PARTIALLY_PAID;
  }

  resolveOrderPaymentStatus(order: Order, paymentIncrement = 0) {
    return this.resolveNextPaymentStatus(order, paymentIncrement);
  }

  async registerForOrderFinalization(
    userScope: ScopedUser,
    order: Order,
    dto: {
      payment?: {
        amount?: number;
        method?: string;
        notes?: string;
        paidByUserId?: string;
      };
    }
  ) {
    return this.paymentsRepository.manager.transaction(async (manager) =>
      this.registerForOrderFinalizationTx(manager, userScope, order, dto)
    );
  }

  async registerForOrderFinalizationTx(
    manager: EntityManager,
    userScope: ScopedUser,
    order: Order,
    dto: {
      payment?: {
        amount?: number;
        method?: string;
        notes?: string;
        paidByUserId?: string;
      };
    }
  ) {
    const orderRepo = manager.getRepository(Order);
    const paymentRepo = manager.getRepository(Payment);
    const movementRepo = manager.getRepository(CashMovement);

    const lockedOrder = await orderRepo
      .createQueryBuilder('order')
      .where('order.id = :id', { id: order.id })
      .setLock('pessimistic_write')
      .getOne();

    if (!lockedOrder) {
      throw new NotFoundException(`Order ${order.id} not found`);
    }

    const pendingAmount = this.roundCurrency(
      Math.max(
        Number(lockedOrder.approvedTotal || lockedOrder.total || 0) -
          Number(lockedOrder.amountPaid || 0),
        0
      )
    );
    const requestedPaymentAmount = this.roundCurrency(
      Number(dto.payment?.amount || 0)
    );
    const paymentMethod = dto.payment?.method?.trim() || 'cash';
    const isCurrentAccount = paymentMethod === 'current_account';

    if (pendingAmount <= 0) {
      if (requestedPaymentAmount > 0) {
        throw new BadRequestException(
          'El remito ya está pago. No se puede registrar un nuevo cobro'
        );
      }
      return false;
    }

    if (isCurrentAccount && requestedPaymentAmount < 0) {
      throw new BadRequestException('El monto del pago no puede ser negativo');
    }

    if (requestedPaymentAmount > pendingAmount) {
      throw new BadRequestException(
        `El pago no puede superar el saldo pendiente del remito. Pendiente actual: ${pendingAmount}`
      );
    }

    if (
      !isCurrentAccount &&
      (!requestedPaymentAmount || requestedPaymentAmount <= 0)
    ) {
      throw new BadRequestException('El remito requiere pago total para finalizar');
    }

    if (
      !isCurrentAccount &&
      this.roundCurrency(requestedPaymentAmount - pendingAmount) !== 0
    ) {
      throw new BadRequestException(
        `Debes registrar el pago total pendiente para finalizar. Pendiente actual: ${pendingAmount}`
      );
    }

    if (requestedPaymentAmount <= 0) {
      lockedOrder.paymentStatus = this.resolveNextPaymentStatus(lockedOrder);
      await orderRepo.save(lockedOrder);
      return false;
    }

    const paidByUserId = dto.payment?.paidByUserId;

    if (!paidByUserId) {
      throw new BadRequestException('No hay usuario válido para registrar el pago');
    }

    const payment = paymentRepo.create({
      orderId: lockedOrder.id,
      order: lockedOrder,
      amount: requestedPaymentAmount,
      method: paymentMethod,
      paidByUserId,
      branchId: lockedOrder.branchId,
      notes: dto.payment?.notes?.trim() || undefined
    });

    const savedPayment = await paymentRepo.save(payment);
    const register = await this.cashService.getOrCreateOperationalRegisterTx(
      manager,
      userScope,
      lockedOrder.branchId
    );

    await movementRepo.save(
      movementRepo.create({
        amount: requestedPaymentAmount,
        type: CashMovementType.INCOME,
        reason: `Pago ${paymentMethod} - Remito ${lockedOrder.remitoNumber || lockedOrder.id}`,
        register,
        paymentId: savedPayment.id
      })
    );

    lockedOrder.amountPaid = this.roundCurrency(
      Number(lockedOrder.amountPaid || 0) + requestedPaymentAmount
    );
    lockedOrder.paymentStatus = this.resolveNextPaymentStatus(lockedOrder);
    const savedOrder = await orderRepo.save(lockedOrder);

    await this.accountLedgerService.syncOrderDebt(
      {
        order: savedOrder,
        userId: dto.payment?.paidByUserId || userScope.userId,
        notes: dto.payment?.notes
      },
      manager
    );

    return true;
  }

  async create(userScope: ScopedUser, dto: CreatePaymentDto) {
    const savedPaymentId = await this.paymentsRepository.manager.transaction(
      async (manager) => {
        const orderRepo = manager.getRepository(Order);
        const paymentRepo = manager.getRepository(Payment);
        const movementRepo = manager.getRepository(CashMovement);

        const order = await orderRepo
          .createQueryBuilder('order')
          .where('order.id = :id', { id: dto.orderId })
          .setLock('pessimistic_write')
          .getOne();

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        ensureBranchAccess(
          userScope,
          order.branchId,
          'No tienes acceso a los pagos de esta sucursal'
        );

        if (order.status === OrderStatus.DRAFT) {
          throw new BadRequestException(
            'No se pueden registrar pagos sobre remitos en borrador'
          );
        }

        if (
          [
            OrderStatus.REJECTED,
            OrderStatus.CANCELLED,
            OrderStatus.COMPLETED
          ].includes(order.status)
        ) {
          throw new BadRequestException(
            'No se pueden registrar pagos para un remito rechazado, cancelado o completado'
          );
        }

        const paymentAmount = this.roundCurrency(Number(dto.amount || 0));
        const pendingAmount = this.roundCurrency(
          Math.max(
            Number(order.approvedTotal || order.total || 0) -
              Number(order.amountPaid || 0),
            0
          )
        );

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
          throw new BadRequestException(
            'El monto del pago debe ser mayor a cero'
          );
        }

        if (paymentAmount > pendingAmount) {
          throw new BadRequestException(
            'El pago excede el total pendiente de la orden'
          );
        }

        const payment = paymentRepo.create({
          ...dto,
          amount: paymentAmount,
          branchId: order.branchId,
          status: PaymentStatus.ACTIVE
        });
        const savedPayment = await paymentRepo.save(payment);

        const register = await this.cashService.getOrCreateOperationalRegisterTx(
          manager,
          userScope,
          order.branchId
        );

        await movementRepo.save(
          movementRepo.create({
            amount: paymentAmount,
            type: CashMovementType.INCOME,
            reason: `Pago ${dto.method} - Orden ${order.id}`,
            register,
            paymentId: savedPayment.id
          })
        );

        order.amountPaid = this.roundCurrency(
          Number(order.amountPaid || 0) + paymentAmount
        );
        order.paymentStatus = this.resolveNextPaymentStatus(order);
        order.status =
          order.paymentStatus === OrderPaymentStatus.PAID &&
          order.fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
            ? OrderStatus.COMPLETED
            : order.status;
        order.completedAt =
          order.status === OrderStatus.COMPLETED
            ? order.completedAt || new Date()
            : order.completedAt;

        const savedOrder = await orderRepo.save(order);
        await this.accountLedgerService.syncOrderDebt({
          order: savedOrder,
          userId: dto.paidByUserId,
          notes: dto.notes
        }, manager);

        return savedPayment.id;
      }
    );

    return this.findOne(userScope, savedPaymentId);
  }

  findAll(userScope: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para pagos',
      forbiddenMessage: 'No tienes acceso a los pagos de esta sucursal'
    });

    return this.paymentsRepository.find({
      where: resolvedBranchId ? { branchId: resolvedBranchId } : {},
      relations: ['order', 'paidByUser', 'branch', 'reversedByUser']
    });
  }

  async findOne(userScope: ScopedUser, id: string) {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['order', 'paidByUser', 'branch', 'reversedByUser']
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    ensureBranchAccess(
      userScope,
      payment.branchId,
      'No tienes acceso a los pagos de esta sucursal'
    );

    return payment;
  }

  async update(
    userScope: ScopedUser,
    id: string,
    dto: Partial<CreatePaymentDto>
  ) {
    const payment = await this.findOne(userScope, id);
    if (payment.status === PaymentStatus.REVERSED) {
      throw new BadRequestException('No se puede editar un pago revertido');
    }
    await this.paymentsRepository.update(id, dto);
    return this.findOne(userScope, id);
  }

  // async remove(userScope: ScopedUser, id: string, dto?: ReversePaymentDto) {
  //   const result = await this.accountLedgerService.reversePayment({
  //     paymentId: id,
  //     userScope,
  //     reason: dto?.reason
  //   });

  //   const payment = await this.findOne(userScope, id);
  //   return {
  //     reversed: true,
  //     payment,
  //     orderId: result.orderId,
  //     receiptIds: result.receiptIds
  //   };
  // }

  async remove(userScope: ScopedUser, id: string, dto?: ReversePaymentDto) {
  const result = await this.accountLedgerService.reversePayment({
    paymentId: id,
    userScope,
    reason: dto?.reason
  });

  const payment = await this.findOne(userScope, id);
  
  return {
    reversed: true,
    payment,
    orderId: payment.orderId, // Traído directamente de la entidad local
    receiptIds: undefined     // Se envía undefined ya que la reversión no genera comprobantes
  };
}
}
