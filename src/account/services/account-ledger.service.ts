import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import { CustomerBranch } from 'src/customers/entities/customer-branch.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import {
  AccountEntry,
  AccountEntryDirection,
  AccountEntrySourceModule,
  AccountEntryStatus,
  AccountEntryType
} from '../entities/account-entry.entity';
import { CreateAccountEntryDto } from '../dto/create-account-entry.dto';
import { ListAccountEntriesDto } from '../dto/list-account-entries.dto';

@Injectable()
export class AccountLedgerService {
  constructor(
    @InjectRepository(AccountEntry)
    private readonly accountEntryRepo: Repository<AccountEntry>,
    @InjectRepository(CustomerBranch)
    private readonly customerBranchRepo: Repository<CustomerBranch>,
    private readonly dataSource: DataSource
  ) {}

  async create(
    userScope: BranchScopedUser,
    dto: CreateAccountEntryDto,
    externalManager?: EntityManager
  ) {
    const branchId = resolveBranchScope(userScope, {
      requestedBranchId: dto.branchId,
      allowGlobal: false,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para crear movimientos de cuenta corriente',
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para crear movimientos de cuenta corriente'
    });

    if (!branchId) {
      throw new BadRequestException('La sucursal es obligatoria');
    }

    await this.ensureCustomerBelongsToBranch(dto.customerId, branchId, externalManager);

    const idempotencyKey =
      dto.idempotencyKey ||
      `${branchId}:${dto.sourceModule}:${dto.sourceEntityType}:${dto.sourceEntityId}:${dto.entryType}:${dto.entryDirection}`;

    const repo = externalManager
      ? externalManager.getRepository(AccountEntry)
      : this.accountEntryRepo;

    const existing = await repo.findOne({
      where: { idempotencyKey }
    });

    if (existing) {
      return existing;
    }

    const run = async (manager: EntityManager) => {
      const lastEntry = await manager.findOne(AccountEntry, {
        where: {
          customerId: dto.customerId,
          branchId,
          status: AccountEntryStatus.ACTIVE
        },
        order: { branchScopedSequence: 'DESC' }
      });

      const lastBranchEntry = await manager.findOne(AccountEntry, {
        where: { branchId },
        order: { branchScopedSequence: 'DESC' }
      });

      const occurredAt = new Date();

      if (lastEntry && occurredAt < new Date(lastEntry.occurredAt)) {
        throw new BadRequestException(
          'No se permiten movimientos con fecha anterior al último movimiento registrado'
        );
      }

      const amount = this.roundCurrency(Number(dto.amount));
      const signedAmount =
        dto.entryDirection === AccountEntryDirection.DEBIT ? amount : -amount;
      const balanceAfter = this.roundCurrency(
        Number(lastEntry?.balanceAfter || 0) + signedAmount
      );

      const entry = manager.create(AccountEntry, {
        branchId,
        customerId: dto.customerId,
        entryType: dto.entryType,
        entryDirection: dto.entryDirection,
        amount,
        balanceAfter,
        sourceModule: dto.sourceModule,
        sourceEntityType: dto.sourceEntityType,
        sourceEntityId: dto.sourceEntityId,
        idempotencyKey,
        branchScopedSequence: Number(lastBranchEntry?.branchScopedSequence || 0) + 1,
        occurredAt,
        createdByUserId: userScope.userId || dto.cashierUserId,
        cashierUserId: dto.cashierUserId,
        reasonCode: dto.reasonCode,
        reasonText: dto.reasonText,
        notes: dto.notes,
        reversedByEntryId: dto.reversedByEntryId
      });

      return manager.save(AccountEntry, entry);
    };

    return externalManager ? run(externalManager) : this.dataSource.transaction(run);
  }

  async findAll(userScope: BranchScopedUser, filters: ListAccountEntriesDto = {}) {
    const branchId = resolveBranchScope(userScope, {
      requestedBranchId: filters.branchId,
      allowGlobal: true,
      globalPermissions: ['view_all_reports', 'view_reports'],
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para consultar cuenta corriente',
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para consultar cuenta corriente'
    });

    const qb = this.accountEntryRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.customer', 'customer')
      .leftJoinAndSelect('entry.branch', 'branch')
      .leftJoinAndSelect('entry.createdByUser', 'createdByUser')
      .where('entry.status = :status', { status: AccountEntryStatus.ACTIVE })
      .orderBy('entry.occurredAt', 'DESC')
      .addOrderBy('entry.createdAt', 'DESC');

    if (branchId) {
      qb.andWhere('entry.branchId = :branchId', { branchId });
    }

    if (filters.customerId) {
      qb.andWhere('entry.customerId = :customerId', {
        customerId: filters.customerId
      });
    }

    if (filters.from) {
      qb.andWhere('entry.occurredAt >= :from', { from: filters.from });
    }

    if (filters.to) {
      qb.andWhere('entry.occurredAt <= :to', { to: filters.to });
    }

    return qb.getMany();
  }

  async findOne(userScope: BranchScopedUser, id: string) {
    const entry = await this.accountEntryRepo.findOne({ where: { id } });

    if (!entry) {
      throw new BadRequestException('Movimiento de cuenta corriente no encontrado');
    }

    ensureBranchAccess(
      userScope,
      entry.branchId,
      'No tienes acceso a la sucursal de este movimiento de cuenta corriente',
      ['view_all_reports', 'view_reports']
    );

    return entry;
  }

  async syncOrderDebt(params: {
    order: Order;
    userId?: string;
    notes?: string;
  }, externalManager?: EntityManager) {
    const { order, userId, notes } = params;

    if (!order.customerId || !order.branchId) {
      return null;
    }

    const approvedAmount = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    const amountPaid = this.roundCurrency(Number(order.amountPaid || 0));

    if (approvedAmount <= 0) {
      return null;
    }

    const userScope: BranchScopedUser = {
      userId,
      activeBranchId: order.branchId,
      branchId: order.branchId
    };

    const debitEntry = await this.create(
      userScope,
      {
        customerId: order.customerId,
        branchId: order.branchId,
        entryType: AccountEntryType.SALE_CHARGE,
        entryDirection: AccountEntryDirection.DEBIT,
        amount: approvedAmount,
        sourceModule: AccountEntrySourceModule.SALES,
        sourceEntityType: 'order',
        sourceEntityId: order.id,
        idempotencyKey: `${order.branchId}:order:${order.id}:sale_charge`,
        reasonCode: 'order_debt',
        reasonText: `Deuda generada por remito ${order.remitoNumber || order.id}`,
        notes
      },
      externalManager
    );

    if (amountPaid <= 0) {
      return debitEntry;
    }

    return this.create(
      userScope,
      {
        customerId: order.customerId,
        branchId: order.branchId,
        entryType: AccountEntryType.PAYMENT,
        entryDirection: AccountEntryDirection.CREDIT,
        amount: amountPaid,
        sourceModule: AccountEntrySourceModule.PAYMENTS,
        sourceEntityType: 'order_payment_total',
        sourceEntityId: order.id,
        idempotencyKey: `${order.branchId}:order:${order.id}:payment_total:${amountPaid}`,
        reasonCode: 'order_payment',
        reasonText: `Cobro aplicado al remito ${order.remitoNumber || order.id}`,
        notes
      },
      externalManager
    );
  }

  async reversePayment(params: {
    paymentId: string;
    userScope: BranchScopedUser;
    reason?: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: params.paymentId },
        relations: ['order']
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      ensureBranchAccess(
        params.userScope,
        payment.branchId,
        'No tienes acceso a los pagos de esta sucursal'
      );

      if (payment.status === PaymentStatus.REVERSED) {
        throw new BadRequestException('El pago ya fue revertido');
      }

      const order = payment.order;

      if (!order?.customerId || !order.branchId) {
        throw new BadRequestException(
          'El pago no tiene una orden con cliente y sucursal válidos'
        );
      }

      const originalEntry = await manager.findOne(AccountEntry, {
        where: {
          sourceModule: AccountEntrySourceModule.PAYMENTS,
          sourceEntityType: 'order_payment_total',
          sourceEntityId: order.id,
          entryType: AccountEntryType.PAYMENT,
          status: AccountEntryStatus.ACTIVE
        },
        order: { createdAt: 'DESC' }
      });

      if (!originalEntry) {
        throw new BadRequestException(
          'No se encontró el asiento original del pago para reversar'
        );
      }

      const entry = await this.create(params.userScope, {
        customerId: order.customerId,
        branchId: order.branchId,
        entryType: AccountEntryType.PAYMENT_REVERSAL,
        entryDirection: AccountEntryDirection.DEBIT,
        amount: Number(payment.amount || 0),
        sourceModule: AccountEntrySourceModule.PAYMENTS,
        sourceEntityType: 'payment_reversal',
        sourceEntityId: payment.id,
        idempotencyKey: `${order.branchId}:payment:${payment.id}:reversal`,
        reasonCode: 'payment_reversal',
        reasonText: params.reason || 'Reversión administrativa del pago',
        reversedByEntryId: originalEntry.id
      }, manager);

      originalEntry.status = AccountEntryStatus.VOIDED;
      originalEntry.voidedAt = new Date();
      originalEntry.voidedByUserId = params.userScope.userId;
      originalEntry.voidReason = params.reason || 'Reversión administrativa del pago';
      originalEntry.reversedByEntryId = entry.id;
      await manager.save(AccountEntry, originalEntry);

      payment.status = PaymentStatus.REVERSED;
      payment.reversedAt = new Date();
      payment.reversedByUserId = params.userScope.userId;
      payment.reversalReason = params.reason || 'Reversión administrativa del pago';
      await manager.save(Payment, payment);

      return {
        entry,
        paymentId: payment.id,
        orderId: order.id,
        receiptIds: []
      };
    });
  }

  private async ensureCustomerBelongsToBranch(
    customerId: string,
    branchId: string,
    externalManager?: EntityManager
  ) {
    const repo = externalManager
      ? externalManager.getRepository(CustomerBranch)
      : this.customerBranchRepo;
    const assignment = await repo.findOne({
      where: { customerId, branchId, isActive: true }
    });

    if (!assignment) {
      throw new BadRequestException(
        'El cliente no pertenece a la sucursal indicada para cuenta corriente'
      );
    }
  }

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
