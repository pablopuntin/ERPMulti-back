import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BranchScopedUser,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import { CustomerBranch } from 'src/customers/entities/customer-branch.entity';
import {
  AccountEntry,
  AccountEntryStatus
} from '../entities/account-entry.entity';
import { toAccountStatement } from '../mappers/account-statement.mapper';

@Injectable()
export class AccountStatementService {
  constructor(
    @InjectRepository(AccountEntry)
    private readonly accountEntryRepo: Repository<AccountEntry>,
    @InjectRepository(CustomerBranch)
    private readonly customerBranchRepo: Repository<CustomerBranch>
  ) {}

  async getCustomerStatement(
    userScope: BranchScopedUser,
    customerId: string,
    requestedBranchId?: string
  ) {
    const branchId = resolveBranchScope(userScope, {
      requestedBranchId,
      allowGlobal: false,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para consultar el estado de cuenta',
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para consultar el estado de cuenta'
    });

    if (!branchId) {
      throw new BadRequestException('La sucursal es obligatoria');
    }

    const assignment = await this.customerBranchRepo.findOne({
      where: { customerId, branchId, isActive: true }
    });

    if (!assignment) {
      throw new BadRequestException(
        'El cliente no pertenece a la sucursal indicada para cuenta corriente'
      );
    }

    const lastEntry = await this.accountEntryRepo.findOne({
      where: {
        customerId,
        branchId,
        status: AccountEntryStatus.ACTIVE
      },
      order: { occurredAt: 'DESC', createdAt: 'DESC' }
    });

    return toAccountStatement({
      customerId,
      branchId,
      rawBalance: Number(lastEntry?.balanceAfter || 0),
      lastMovementAt: lastEntry?.occurredAt || null
    });
  }

  async getLegacyCustomerSummary(
    userScope: BranchScopedUser,
    customerId: string,
    requestedBranchId?: string
  ) {
    const statement = await this.getCustomerStatement(
      userScope,
      customerId,
      requestedBranchId
    );

    return {
      customerId: statement.customerId,
      totalBalance: statement.debtAmount,
      rawBalance: statement.rawBalance,
      debtAmount: statement.debtAmount,
      creditAmount: statement.creditAmount,
      overdueBalance: 0,
      openDocuments: statement.debtAmount > 0 ? 1 : 0,
      partiallyPaidDocuments: 0,
      paidDocuments: statement.debtAmount === 0 ? 1 : 0,
      lastPaymentAt: statement.lastMovementAt,
      nextDueDate: null
    };
  }
}
