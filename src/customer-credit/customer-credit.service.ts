import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus
} from 'src/orders/entities/order.entity';
import {
  CustomerCreditDocument,
  CustomerCreditDocumentStatus
} from './entities/customer-credit-document.entity';
import {
  CustomerCreditMovement,
  CustomerCreditMovementSign,
  CustomerCreditMovementType
} from './entities/customer-credit-movement.entity';
import {
  ApplyCustomerCreditPaymentDto,
  CustomerCreditPaymentMode
} from './dto/apply-customer-credit-payment.dto';
import {
  ApplyCustomerCreditAdjustmentDto,
  CustomerCreditAdjustmentType
} from './dto/apply-customer-credit-adjustment.dto';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import {
  CashMovement,
  CashMovementType
} from 'src/cash/entities/cash-movement.entity';
import { CashService } from 'src/cash/cash.service';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import {
  CustomerCreditReceipt,
  CustomerCreditReceiptMode
} from './entities/customer-credit-receipt.entity';
import { CustomerCreditReceiptItem } from './entities/customer-credit-receipt-item.entity';
import { CustomerCreditReceiptPdfService } from './customer-credit-receipt-pdf.service';

type ScopedUser = BranchScopedUser;

type ResolvedCreditApplication = {
  document: CustomerCreditDocument;
  amount: number;
};

@Injectable()
export class CustomerCreditService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerCreditDocument)
    private readonly creditDocumentRepo: Repository<CustomerCreditDocument>,
    @InjectRepository(CustomerCreditMovement)
    private readonly creditMovementRepo: Repository<CustomerCreditMovement>,
    @InjectRepository(CustomerCreditReceipt)
    private readonly creditReceiptRepo: Repository<CustomerCreditReceipt>,
    @InjectRepository(CustomerCreditReceiptItem)
    private readonly creditReceiptItemRepo: Repository<CustomerCreditReceiptItem>,
    private readonly cashService: CashService,
    private readonly customerCreditReceiptPdfService: CustomerCreditReceiptPdfService
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private resolveNextOrderPaymentStatus(order: Order, paymentAmount: number) {
    const approvedTotal = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    const nextAmountPaid = this.roundCurrency(
      Number(order.amountPaid || 0) + Number(paymentAmount || 0)
    );

    if (nextAmountPaid <= 0) {
      return OrderPaymentStatus.UNPAID;
    }

    if (nextAmountPaid >= approvedTotal) {
      return OrderPaymentStatus.PAID;
    }

    return OrderPaymentStatus.PARTIALLY_PAID;
  }

  private resolveOperationalBranchId(
    userScope: ScopedUser,
    requestedBranchId?: string
  ): string {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId,
      allowGlobal: false,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para consultar cuenta corriente',
      forbiddenMessage:
        'No tienes acceso a la sucursal seleccionada para cuenta corriente'
    });

    if (!resolvedBranchId) {
      throw new BadRequestException(
        'No hay una sucursal activa definida para consultar cuenta corriente'
      );
    }

    return resolvedBranchId;
  }

  private async getCustomerOrThrow(
    customerId: string,
    userScope?: ScopedUser,
    branchId?: string
  ) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, isActive: true },
      relations: ['branchAssignments', 'branchAssignments.branch']
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (userScope) {
      const scopedBranchId = this.resolveOperationalBranchId(userScope, branchId);
      const hasActiveAssignment = (customer.branchAssignments || []).some(
        (assignment) =>
          assignment.isActive !== false && assignment.branchId === scopedBranchId
      );

      if (!hasActiveAssignment) {
        throw new NotFoundException('Customer not found');
      }
    }

    return customer;
  }

  private async getScopedCustomerDocuments(
    customerId: string,
    branchId: string,
    manager?: EntityManager
  ) {
    const creditDocumentRepo =
      manager?.getRepository(CustomerCreditDocument) || this.creditDocumentRepo;

    return creditDocumentRepo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.order', 'order')
      .leftJoinAndSelect('document.customer', 'customer')
      .leftJoinAndSelect('document.createdByUser', 'createdByUser')
      .where('document.customerId = :customerId', { customerId })
      .andWhere('order.branchId = :branchId', { branchId })
      .orderBy('document.createdAt', 'DESC')
      .getMany();
  }

  private async getScopedCustomerMovements(
    customerId: string,
    branchId: string,
    manager?: EntityManager
  ) {
    const creditMovementRepo =
      manager?.getRepository(CustomerCreditMovement) || this.creditMovementRepo;

    return creditMovementRepo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.order', 'order')
      .leftJoinAndSelect('movement.customer', 'customer')
      .leftJoinAndSelect('movement.creditDocument', 'creditDocument')
      .leftJoinAndSelect('movement.payment', 'payment')
      .leftJoinAndSelect('movement.performedByUser', 'performedByUser')
      .where('movement.customerId = :customerId', { customerId })
      .andWhere('(order.branchId = :branchId OR (order.id IS NULL AND creditDocument.orderId IS NOT NULL))', {
        branchId
      })
      .orderBy('movement.createdAt', 'DESC')
      .getMany()
      .then((movements) =>
        movements.filter(
          (movement) =>
            movement.order?.branchId === branchId ||
            movement.creditDocument?.order?.branchId === branchId
        )
      );
  }

  private sortByDueDateAndCreation(documents: CustomerCreditDocument[]) {
    return [...documents].sort((a, b) => {
      const dueA = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) {
        return dueA - dueB;
      }

      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdA - createdB;
    });
  }

  private resolveReceiptMode(
    mode?: CustomerCreditPaymentMode
  ): CustomerCreditReceiptMode {
    return mode === CustomerCreditPaymentMode.BY_DOCUMENTS
      ? CustomerCreditReceiptMode.BY_DOCUMENTS
      : CustomerCreditReceiptMode.AUTO;
  }

  private resolveSyncedDocumentStatus(balance: number, amountPaid: number) {
    if (balance <= 0) {
      return CustomerCreditDocumentStatus.PAID;
    }

    return amountPaid > 0
      ? CustomerCreditDocumentStatus.PARTIALLY_PAID
      : CustomerCreditDocumentStatus.OPEN;
  }

  private resolveAdjustedDocumentStatus(document: CustomerCreditDocument) {
    const balance = this.roundCurrency(Number(document.balance || 0));
    const amountPaid = this.roundCurrency(Number(document.amountPaid || 0));

    if (balance <= 0) {
      return CustomerCreditDocumentStatus.PAID;
    }

    return amountPaid > 0 || balance < this.roundCurrency(Number(document.currentAmount || 0))
      ? CustomerCreditDocumentStatus.PARTIALLY_PAID
      : CustomerCreditDocumentStatus.OPEN;
  }

  private async resolveApplications(params: {
    mode: CustomerCreditPaymentMode;
    amount?: number;
    applications?: ApplyCustomerCreditPaymentDto['applications'];
    openDocuments: CustomerCreditDocument[];
  }) {
    const { mode, amount, applications, openDocuments } = params;

    if (!openDocuments.length) {
      throw new BadRequestException(
        'El cliente no tiene comprobantes pendientes en cuenta corriente'
      );
    }

    if (mode === CustomerCreditPaymentMode.BY_DOCUMENTS) {
      if (!applications?.length) {
        throw new BadRequestException(
          'Debes seleccionar al menos un remito para el cobro por comprobante'
        );
      }

      const openDocumentsById = new Map(
        openDocuments.map((document) => [document.id, document])
      );
      const groupedAmounts = new Map<string, number>();

      applications.forEach((application) => {
        const current = this.roundCurrency(
          groupedAmounts.get(application.creditDocumentId) || 0
        );
        groupedAmounts.set(
          application.creditDocumentId,
          this.roundCurrency(current + Number(application.amount || 0))
        );
      });

      const resolved = [...groupedAmounts.entries()].map(
        ([creditDocumentId, requestedAmount]) => {
          const document = openDocumentsById.get(creditDocumentId);

          if (!document) {
            throw new BadRequestException(
              'Uno de los remitos seleccionados no está pendiente o no pertenece al cliente'
            );
          }

          const normalizedAmount = this.roundCurrency(
            Number(requestedAmount || 0)
          );
          if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
            throw new BadRequestException(
              'Cada remito seleccionado debe tener un monto mayor a cero'
            );
          }

          const currentBalance = this.roundCurrency(
            Number(document.balance || 0)
          );
          if (normalizedAmount > currentBalance) {
            throw new BadRequestException(
              `El monto para el remito ${document.orderRemitoNumber || document.orderId} supera su saldo pendiente`
            );
          }

          return {
            document,
            amount: normalizedAmount
          } as ResolvedCreditApplication;
        }
      );

      const totalByDocuments = this.roundCurrency(
        resolved.reduce((sum, item) => sum + item.amount, 0)
      );
      if (amount && this.roundCurrency(amount) !== totalByDocuments) {
        throw new BadRequestException(
          'El importe total no coincide con la suma de los remitos seleccionados'
        );
      }

      return {
        resolved,
        requestedAmount: totalByDocuments
      };
    }

    const normalizedAmount = this.roundCurrency(Number(amount || 0));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new BadRequestException(
        'Debes ingresar un importe mayor a cero para el cobro automático'
      );
    }

    const sortedDocuments = this.sortByDueDateAndCreation(openDocuments);
    const totalOpen = this.roundCurrency(
      sortedDocuments.reduce(
        (sum, document) => sum + Number(document.balance || 0),
        0
      )
    );
    if (normalizedAmount > totalOpen) {
      throw new BadRequestException(
        `El importe supera la deuda pendiente total del cliente (${totalOpen})`
      );
    }

    let remaining = normalizedAmount;
    const autoResolved: ResolvedCreditApplication[] = [];

    sortedDocuments.forEach((document) => {
      const currentBalance = this.roundCurrency(Number(document.balance || 0));
      if (remaining <= 0 || currentBalance <= 0) {
        return;
      }

      const amountToApply = this.roundCurrency(
        Math.min(remaining, currentBalance)
      );
      if (amountToApply > 0) {
        autoResolved.push({
          document,
          amount: amountToApply
        });
      }

      remaining = this.roundCurrency(remaining - amountToApply);
    });

    if (remaining > 0) {
      throw new BadRequestException(
        'No se pudo imputar el importe completo sobre los remitos pendientes'
      );
    }

    return {
      resolved: autoResolved,
      requestedAmount: normalizedAmount
    };
  }

  async applyCustomerPayment(
    userScope: ScopedUser,
    customerId: string,
    dto: ApplyCustomerCreditPaymentDto
  ) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope);
    const paymentResult = await this.creditDocumentRepo.manager.transaction(
      async (manager) => {
        const customerRepo = manager.getRepository(Customer);
        const orderRepo = manager.getRepository(Order);
        const paymentRepo = manager.getRepository(Payment);
        const creditDocumentRepo = manager.getRepository(CustomerCreditDocument);
        const creditMovementRepo = manager.getRepository(CustomerCreditMovement);
        const creditReceiptRepo = manager.getRepository(CustomerCreditReceipt);
        const creditReceiptItemRepo =
          manager.getRepository(CustomerCreditReceiptItem);
        const cashMovementRepo = manager.getRepository(CashMovement);

        const customer = await customerRepo.findOne({
          where: { id: customerId, isActive: true }
        });
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }

        await this.getCustomerOrThrow(customerId, userScope, scopedBranchId);

        const openDocuments = await creditDocumentRepo
          .createQueryBuilder('document')
          .leftJoinAndSelect('document.order', 'order')
          .where('document.customerId = :customerId', { customerId })
          .andWhere('order.branchId = :branchId', { branchId: scopedBranchId })
          .andWhere('document.status IN (:...statuses)', {
            statuses: [
              CustomerCreditDocumentStatus.OPEN,
              CustomerCreditDocumentStatus.PARTIALLY_PAID
            ]
          })
          .orderBy('document.createdAt', 'ASC')
          .setLock('pessimistic_write')
          .getMany();

        const documentsWithBalance = openDocuments.filter(
          (document) => this.roundCurrency(Number(document.balance || 0)) > 0
        );

        documentsWithBalance.forEach((document) => {
          ensureBranchAccess(
            userScope,
            document.order?.branchId,
            'No tienes acceso a la sucursal de uno de los remitos seleccionados'
          );
        });

        const mode = dto.mode || CustomerCreditPaymentMode.AUTO;
        const { resolved, requestedAmount } = await this.resolveApplications({
          mode,
          amount: dto.amount,
          applications: dto.applications,
          openDocuments: documentsWithBalance
        });

        if (!resolved.length) {
          throw new BadRequestException(
            'No se encontraron imputaciones válidas para registrar el cobro'
          );
        }

        const uniqueBranches = new Set(
          resolved
            .map((item) => item.document.order?.branchId)
            .filter((branchId): branchId is string => Boolean(branchId))
        );

        if (uniqueBranches.size !== 1 || !uniqueBranches.has(scopedBranchId)) {
          throw new BadRequestException(
            'Los cobros de cuenta corriente deben imputarse únicamente a documentos de la sucursal operativa activa'
          );
        }

        const paidByUserId = dto.paidByUserId || userScope.userId;
        if (!paidByUserId) {
          throw new BadRequestException(
            'No hay usuario válido para registrar el cobro'
          );
        }
        const paymentMethod = dto.method?.trim() || 'cash';

        const receipt = await creditReceiptRepo.save(
          creditReceiptRepo.create({
            customerId: customer.id,
            customer,
            mode: this.resolveReceiptMode(mode),
            requestedAmount,
            appliedAmount: requestedAmount,
            method: paymentMethod,
            branchId: scopedBranchId,
            createdByUserId: paidByUserId,
            notes: dto.notes?.trim() || undefined
          })
        );

        const appliedAt = new Date();

        for (const item of resolved) {
          const document = item.document;
          const amountToApply = this.roundCurrency(item.amount);

          const order = await orderRepo
            .createQueryBuilder('order')
            .where('order.id = :id', { id: document.orderId })
            .setLock('pessimistic_write')
            .getOne();

          if (!order) {
            throw new NotFoundException(
              `Order ${document.orderId} not found for credit document ${document.id}`
            );
          }

          ensureBranchAccess(
            userScope,
            order.branchId,
            'No tienes acceso a la sucursal de uno de los remitos seleccionados'
          );

          const previousDocumentBalance = this.roundCurrency(
            Number(document.balance || 0)
          );
          if (amountToApply > previousDocumentBalance) {
            throw new BadRequestException(
              `El monto imputado supera el saldo pendiente del remito ${document.orderRemitoNumber || document.orderId}`
            );
          }

          const payment = await paymentRepo.save(
            paymentRepo.create({
              orderId: order.id,
              order,
              amount: amountToApply,
              method: paymentMethod,
              paidByUserId,
              branchId: order.branchId,
              notes: [dto.notes?.trim(), `Recibo CC ${receipt.id}`]
                .filter(Boolean)
                .join(' · ')
            })
          );

          const register = await this.cashService.getOrCreateOperationalRegisterTx(
            manager,
            userScope,
            order.branchId
          );

          await cashMovementRepo.save(
            cashMovementRepo.create({
              amount: amountToApply,
              type: CashMovementType.INCOME,
              reason: `Cobro CC ${paymentMethod} - Remito ${order.remitoNumber || order.id} - Recibo ${receipt.id}`,
              register,
              paymentId: payment.id
            })
          );

          order.amountPaid = this.roundCurrency(
            Number(order.amountPaid || 0) + amountToApply
          );
          order.paymentStatus = this.resolveNextOrderPaymentStatus(
            order,
            amountToApply
          );
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

          document.amountPaid = this.roundCurrency(
            Number(document.amountPaid || 0) + amountToApply
          );
          document.balance = this.roundCurrency(
            Math.max(previousDocumentBalance - amountToApply, 0)
          );
          document.status =
            document.balance <= 0
              ? CustomerCreditDocumentStatus.PAID
              : CustomerCreditDocumentStatus.PARTIALLY_PAID;
          document.firstPaymentAt = document.firstPaymentAt || appliedAt;
          document.lastPaymentAt = appliedAt;

          const savedDocument = await creditDocumentRepo.save(document);

          await creditMovementRepo.save(
            creditMovementRepo.create({
              customerId: customer.id,
              customer,
              creditDocumentId: savedDocument.id,
              creditDocument: savedDocument,
              orderId: savedOrder.id,
              order: savedOrder,
              paymentId: payment.id,
              payment,
              type: CustomerCreditMovementType.PAYMENT,
              sign: CustomerCreditMovementSign.CREDIT,
              amount: amountToApply,
              balanceAfter: savedDocument.balance,
              description: `Cobro aplicado al remito ${document.orderRemitoNumber || order.id}.`,
              metadata: JSON.stringify({
                receiptId: receipt.id,
                method: paymentMethod,
                branchId: scopedBranchId,
                auditCategory: 'customer_credit_payment',
                isSensitive: true
              }),
              performedByUserId: paidByUserId
            })
          );
        }

        return { receiptId: receipt.id };
      }
    );

    const fullReceipt = await this.getCustomerReceipt(
      customerId,
      paymentResult.receiptId,
      userScope
    );
    const summary = await this.getCustomerSummary(customerId, userScope);

    return {
      receipt: fullReceipt,
      summary
    };
  }

  async getCustomerReceipt(
    customerId: string,
    receiptId: string,
    userScope: ScopedUser
  ) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope);
    await this.getCustomerOrThrow(customerId, userScope, scopedBranchId);

    const receipt = await this.creditReceiptRepo.findOne({
      where: { id: receiptId, customerId }
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    if (receipt.branchId && receipt.branchId !== scopedBranchId) {
      throw new NotFoundException('Receipt not found');
    }

    (receipt.items || []).forEach((item) => {
      ensureBranchAccess(
        userScope,
        item.order?.branchId,
        'No tienes acceso a la sucursal de uno de los remitos del recibo'
      );
    });

    return receipt;
  }

  async generateCustomerReceiptPdf(
    customerId: string,
    receiptId: string,
    userScope: ScopedUser
  ) {
    const receipt = await this.getCustomerReceipt(
      customerId,
      receiptId,
      userScope
    );
    return this.customerCreditReceiptPdfService.generate(receipt);
  }

  async reversePayment(params: {
    paymentId: string;
    userScope: ScopedUser;
    reason?: string;
    manager?: EntityManager;
  }) {
    const { paymentId, userScope, reason, manager } = params;

    const executeReversal = async (activeManager: EntityManager) => {
      const paymentRepo = activeManager.getRepository(Payment);
      const orderRepo = activeManager.getRepository(Order);
      const creditDocumentRepo = activeManager.getRepository(CustomerCreditDocument);
      const creditMovementRepo =
        activeManager.getRepository(CustomerCreditMovement);
      const cashMovementRepo = activeManager.getRepository(CashMovement);
      const creditReceiptItemRepo =
        activeManager.getRepository(CustomerCreditReceiptItem);

      const payment = await paymentRepo
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.order', 'order')
        .where('payment.id = :id', { id: paymentId })
        .setLock('pessimistic_write')
        .getOne();

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      ensureBranchAccess(
        userScope,
        payment.branchId,
        'No tienes acceso a los pagos de esta sucursal'
      );

      if (payment.status === PaymentStatus.REVERSED) {
        throw new BadRequestException('El pago ya fue revertido');
      }

      const order = await orderRepo
        .createQueryBuilder('order')
        .where('order.id = :id', { id: payment.orderId })
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

      const paymentAmount = this.roundCurrency(Number(payment.amount || 0));
      order.amountPaid = this.roundCurrency(
        Math.max(Number(order.amountPaid || 0) - paymentAmount, 0)
      );
      order.paymentStatus = this.resolveNextOrderPaymentStatus(
        order,
        -paymentAmount
      );

      if (order.status === OrderStatus.COMPLETED) {
        order.status =
          order.fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
            ? OrderStatus.APPROVED
            : OrderStatus.SENT_TO_CASH;
        order.completedAt = undefined;
      }

      const savedOrder = await orderRepo.save(order);

      const linkedDocument = await creditDocumentRepo.findOne({
        where: { orderId: savedOrder.id }
      });

      if (linkedDocument) {
        const previousBalance = this.roundCurrency(
          Number(linkedDocument.balance || 0)
        );
        linkedDocument.amountPaid = this.roundCurrency(
          Math.max(Number(linkedDocument.amountPaid || 0) - paymentAmount, 0)
        );
        linkedDocument.balance = this.roundCurrency(
          Math.max(Number(linkedDocument.currentAmount || 0) - Number(linkedDocument.amountPaid || 0), 0)
        );
        linkedDocument.status = this.resolveSyncedDocumentStatus(
          linkedDocument.balance,
          Number(linkedDocument.amountPaid || 0)
        );
        if (linkedDocument.amountPaid <= 0) {
          linkedDocument.lastPaymentAt = undefined;
          linkedDocument.firstPaymentAt = undefined;
        }

        const savedDocument = await creditDocumentRepo.save(linkedDocument);

        await creditMovementRepo.save(
          creditMovementRepo.create({
            customerId: savedDocument.customerId,
            customer: savedDocument.customer,
            creditDocumentId: savedDocument.id,
            creditDocument: savedDocument,
            orderId: savedOrder.id,
            order: savedOrder,
            paymentId: payment.id,
            payment,
            type: CustomerCreditMovementType.PAYMENT_REVERSAL,
            sign: CustomerCreditMovementSign.DEBIT,
            amount: paymentAmount,
            balanceAfter: savedDocument.balance,
            description: `Reversión de cobro del remito ${savedDocument.orderRemitoNumber || savedOrder.id}.`,
            metadata: JSON.stringify({
              reversalReason: reason?.trim() || null,
              previousBalance,
              paymentMethod: payment.method
            }),
            performedByUserId: userScope.userId
          })
        );
      } else {
        await this.syncOrderDebt({
          order: savedOrder,
          userId: userScope.userId,
          notes: reason,
          manager: activeManager
        });
      }

      const cashMovement = await cashMovementRepo.findOne({
        where: { paymentId: payment.id },
        relations: ['register']
      });

      if (cashMovement) {
        await cashMovementRepo.save(
          cashMovementRepo.create({
            amount: paymentAmount,
            type: CashMovementType.EXPENSE,
            reason: `Reversión de pago ${payment.method} - Orden ${savedOrder.id}${reason?.trim() ? ` - ${reason.trim()}` : ''}`,
            register: cashMovement.register
          })
        );
      }

      const receiptItems = await creditReceiptItemRepo.find({
        where: { paymentId: payment.id }
      });

      payment.status = PaymentStatus.REVERSED;
      payment.reversedAt = new Date();
      payment.reversedByUserId = userScope.userId;
      payment.reversalReason = reason?.trim() || 'Reversión administrativa del pago';
      await paymentRepo.save(payment);

      return {
        paymentId: payment.id,
        receiptIds: [...new Set(receiptItems.map((item) => item.receiptId).filter(Boolean))],
        orderId: savedOrder.id
      };
    };

    if (manager) {
      return executeReversal(manager);
    }

    return this.creditDocumentRepo.manager.transaction(executeReversal);
  }

  async applyDocumentAdjustment(
    userScope: ScopedUser,
    customerId: string,
    dto: ApplyCustomerCreditAdjustmentDto
  ) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope);
    const result = await this.creditDocumentRepo.manager.transaction(async (manager) => {
      const customerRepo = manager.getRepository(Customer);
      const creditDocumentRepo = manager.getRepository(CustomerCreditDocument);
      const creditMovementRepo = manager.getRepository(CustomerCreditMovement);

      const customer = await customerRepo.findOne({
        where: { id: customerId, isActive: true }
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      await this.getCustomerOrThrow(customerId, userScope, scopedBranchId);

      const document = await creditDocumentRepo
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.order', 'order')
        .where('document.id = :id', { id: dto.creditDocumentId })
        .andWhere('document.customerId = :customerId', { customerId })
        .andWhere('order.branchId = :branchId', { branchId: scopedBranchId })
        .setLock('pessimistic_write')
        .getOne();

      if (!document) {
        throw new NotFoundException('Credit document not found');
      }

      ensureBranchAccess(
        userScope,
        document.order?.branchId,
        'No tienes acceso a la sucursal de este comprobante'
      );

      if (document.status === CustomerCreditDocumentStatus.CANCELLED) {
        throw new BadRequestException(
          'No se puede ajustar un comprobante cancelado'
        );
      }

      const adjustmentAmount = this.roundCurrency(Number(dto.amount || 0));
      if (!Number.isFinite(adjustmentAmount) || adjustmentAmount <= 0) {
        throw new BadRequestException('El importe del ajuste debe ser mayor a cero');
      }

      const trimmedReason = dto.reason?.trim();
      if (!trimmedReason) {
        throw new BadRequestException('El motivo del ajuste es obligatorio');
      }

      const previousCurrentAmount = this.roundCurrency(
        Number(document.currentAmount || 0)
      );
      const previousBalance = this.roundCurrency(Number(document.balance || 0));
      const currentPaidAmount = this.roundCurrency(Number(document.amountPaid || 0));

      if (dto.type === CustomerCreditAdjustmentType.CREDIT_NOTE) {
        const maxReducible = this.roundCurrency(
          Math.max(previousCurrentAmount - currentPaidAmount, 0)
        );
        if (adjustmentAmount > maxReducible) {
          throw new BadRequestException(
            'La nota de crédito supera el saldo ajustable del comprobante. El saldo a favor se implementará en una etapa posterior.'
          );
        }

        document.currentAmount = this.roundCurrency(
          previousCurrentAmount - adjustmentAmount
        );
        document.balance = this.roundCurrency(
          Math.max(Number(document.currentAmount || 0) - currentPaidAmount, 0)
        );
      } else {
        document.currentAmount = this.roundCurrency(
          previousCurrentAmount + adjustmentAmount
        );
        document.balance = this.roundCurrency(
          Math.max(Number(document.currentAmount || 0) - currentPaidAmount, 0)
        );
      }

      document.status = this.resolveAdjustedDocumentStatus(document);
      document.notes = [document.notes?.trim(), `${dto.type === CustomerCreditAdjustmentType.CREDIT_NOTE ? 'Nota de crédito' : 'Nota de débito'}: ${trimmedReason}`]
        .filter(Boolean)
        .join(' · ');

      const savedDocument = await creditDocumentRepo.save(document);

      const movementType =
        dto.type === CustomerCreditAdjustmentType.CREDIT_NOTE
          ? CustomerCreditMovementType.DISCOUNT
          : CustomerCreditMovementType.SURCHARGE;
      const movementSign =
        dto.type === CustomerCreditAdjustmentType.CREDIT_NOTE
          ? CustomerCreditMovementSign.CREDIT
          : CustomerCreditMovementSign.DEBIT;

      await creditMovementRepo.save(
        creditMovementRepo.create({
          customerId: customer.id,
          customer,
          creditDocumentId: savedDocument.id,
          creditDocument: savedDocument,
          orderId: savedDocument.orderId,
          order: savedDocument.order,
          type: movementType,
          sign: movementSign,
          amount: adjustmentAmount,
          balanceAfter: savedDocument.balance,
          description:
            dto.type === CustomerCreditAdjustmentType.CREDIT_NOTE
              ? `Nota de crédito aplicada al remito ${savedDocument.orderRemitoNumber || savedDocument.orderId}.`
              : `Nota de débito aplicada al remito ${savedDocument.orderRemitoNumber || savedDocument.orderId}.`,
          metadata: JSON.stringify({
            adjustmentType: dto.type,
            reason: trimmedReason,
            branchId: scopedBranchId,
            auditCategory: 'customer_credit_adjustment',
            isSensitive: true,
            previousCurrentAmount,
            previousBalance,
            newCurrentAmount: savedDocument.currentAmount,
            newBalance: savedDocument.balance
          }),
          performedByUserId: userScope.userId
        })
      );

      return {
        document: savedDocument
      };
    });

    return {
      ...result,
      summary: await this.getCustomerSummary(customerId, userScope)
    };
  }

  async syncOrderDebt(params: {
    order: Order;
    userId?: string;
    notes?: string;
    manager?: EntityManager;
  }) {
    const { order, userId, notes, manager } = params;

    const customerRepo = manager?.getRepository(Customer) || this.customerRepo;
    const creditDocumentRepo =
      manager?.getRepository(CustomerCreditDocument) || this.creditDocumentRepo;
    const creditMovementRepo =
      manager?.getRepository(CustomerCreditMovement) || this.creditMovementRepo;

    if (!order.customerId) {
      return null;
    }

    const customer = await customerRepo.findOne({
      where: { id: order.customerId, isActive: true }
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${order.customerId} not found`);
    }

    const approvedAmount = this.roundCurrency(
      Number(order.approvedTotal || order.total || 0)
    );
    const amountPaid = this.roundCurrency(Number(order.amountPaid || 0));
    const balance = this.roundCurrency(
      Math.max(approvedAmount - amountPaid, 0)
    );

    const existing = await creditDocumentRepo.findOne({
      where: { orderId: order.id }
    });

    if (balance <= 0) {
      if (!existing) {
        return null;
      }

      existing.originalAmount = approvedAmount;
      existing.currentAmount = approvedAmount;
      existing.amountPaid = amountPaid;
      existing.balance = 0;
      existing.status = CustomerCreditDocumentStatus.PAID;
      if (!existing.firstPaymentAt && amountPaid > 0) {
        existing.firstPaymentAt = new Date();
      }
      existing.lastPaymentAt =
        amountPaid > 0 ? new Date() : existing.lastPaymentAt;
      return creditDocumentRepo.save(existing);
    }

    const nextStatus = this.resolveSyncedDocumentStatus(balance, amountPaid);

    if (existing) {
      const previousBalance = this.roundCurrency(Number(existing.balance || 0));
      const hasBalanceChange =
        this.roundCurrency(previousBalance - balance) !== 0;

      existing.originalAmount = approvedAmount;
      existing.currentAmount = approvedAmount;
      existing.amountPaid = amountPaid;
      existing.balance = balance;
      existing.status = nextStatus;
      existing.orderRemitoNumber = order.remitoNumber;
      existing.notes = notes?.trim() || existing.notes;
      if (!existing.firstPaymentAt && amountPaid > 0) {
        existing.firstPaymentAt = new Date();
      }
      existing.lastPaymentAt =
        amountPaid > 0 ? new Date() : existing.lastPaymentAt;

      const saved = await creditDocumentRepo.save(existing);

      if (hasBalanceChange) {
        await creditMovementRepo.save(
          creditMovementRepo.create({
            customerId: customer.id,
            customer,
            creditDocumentId: saved.id,
            creditDocument: saved,
            orderId: order.id,
            order,
            type: CustomerCreditMovementType.SYSTEM_RECONCILIATION,
            sign:
              previousBalance > balance
                ? CustomerCreditMovementSign.CREDIT
                : CustomerCreditMovementSign.DEBIT,
            amount: Math.abs(this.roundCurrency(balance - previousBalance)),
            balanceAfter: balance,
            description:
              'Actualización automática del saldo pendiente del remito.',
            metadata: JSON.stringify({
              paymentStatus: order.paymentStatus,
              approvedAmount,
              amountPaid
            }),
            performedByUserId: userId
          })
        );
      }

      return saved;
    }

    const dueDate =
      customer.creditPaymentTermDays &&
      Number(customer.creditPaymentTermDays) > 0
        ? new Date(
            Date.now() +
              Number(customer.creditPaymentTermDays) * 24 * 60 * 60 * 1000
          )
        : undefined;

    const created = await creditDocumentRepo.save(
      creditDocumentRepo.create({
        customerId: customer.id,
        customer,
        orderId: order.id,
        order,
        orderRemitoNumber: order.remitoNumber,
        originalAmount: approvedAmount,
        currentAmount: approvedAmount,
        amountPaid,
        balance,
        status: nextStatus,
        dueDate,
        firstPaymentAt: amountPaid > 0 ? new Date() : undefined,
        lastPaymentAt: amountPaid > 0 ? new Date() : undefined,
        pricingLocked: order.paymentStatus !== OrderPaymentStatus.UNPAID,
        pricingUpdatedBeforeFirstPayment: false,
        createdByUserId: userId,
        notes: notes?.trim() || undefined
      })
    );

    await creditMovementRepo.save(
      creditMovementRepo.create({
        customerId: customer.id,
        customer,
        creditDocumentId: created.id,
        creditDocument: created,
        orderId: order.id,
        order,
        type: CustomerCreditMovementType.DOCUMENT_CHARGE,
        sign: CustomerCreditMovementSign.DEBIT,
        amount: balance,
        balanceAfter: balance,
        description: `Saldo pendiente generado por remito ${order.remitoNumber || order.id}.`,
        metadata: JSON.stringify({
          approvedAmount,
          amountPaid
        }),
        performedByUserId: userId
      })
    );

    return created;
  }

  async getCustomerSummary(customerId: string, userScope: ScopedUser) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope);
    const customer = await this.getCustomerOrThrow(
      customerId,
      userScope,
      scopedBranchId
    );

    const scopedDocuments = await this.getScopedCustomerDocuments(
      customerId,
      scopedBranchId
    );

    const totalBalance = this.roundCurrency(
      scopedDocuments.reduce((sum, doc) => sum + Number(doc.balance || 0), 0)
    );
    const overdueBalance = this.roundCurrency(
      scopedDocuments
        .filter(
          (doc) =>
            doc.balance > 0 &&
            doc.dueDate &&
            new Date(doc.dueDate).getTime() < Date.now()
        )
        .reduce((sum, doc) => sum + Number(doc.balance || 0), 0)
    );

    const openDocuments = scopedDocuments.filter(
      (doc) => doc.status === CustomerCreditDocumentStatus.OPEN
    ).length;
    const partiallyPaidDocuments = scopedDocuments.filter(
      (doc) => doc.status === CustomerCreditDocumentStatus.PARTIALLY_PAID
    ).length;
    const paidDocuments = scopedDocuments.filter(
      (doc) => doc.status === CustomerCreditDocumentStatus.PAID
    ).length;
    const nextDueDate = scopedDocuments
      .filter((doc) => doc.balance > 0 && doc.dueDate)
      .sort(
        (a, b) =>
          new Date(a.dueDate as Date).getTime() -
          new Date(b.dueDate as Date).getTime()
      )[0]?.dueDate;
    const lastPaymentAt = scopedDocuments
      .filter((doc) => doc.lastPaymentAt)
      .sort(
        (a, b) =>
          new Date(b.lastPaymentAt as Date).getTime() -
          new Date(a.lastPaymentAt as Date).getTime()
      )[0]?.lastPaymentAt;

    return {
      customerId: customer.id,
      customerName: customer.fullName,
      creditEnabled: customer.isCreditEnabled,
      totalBalance,
      overdueBalance,
      openDocuments,
      partiallyPaidDocuments,
      paidDocuments,
      lastPaymentAt,
      nextDueDate
    };
  }

  async getCustomerDocuments(customerId: string, userScope: ScopedUser) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope);
    await this.getCustomerOrThrow(customerId, userScope, scopedBranchId);

    return this.getScopedCustomerDocuments(customerId, scopedBranchId);
  }

  async getCustomerMovements(customerId: string, userScope: ScopedUser) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope);
    await this.getCustomerOrThrow(customerId, userScope, scopedBranchId);

    return this.getScopedCustomerMovements(customerId, scopedBranchId);
  }
}
