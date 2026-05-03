import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BranchScopedUser,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';
import {
  AccountEntrySourceModule,
  AccountEntryType
} from '../entities/account-entry.entity';
import { AccountAdjustment } from '../entities/account-adjustment.entity';
import { CreateAccountAdjustmentDto } from '../dto/create-account-adjustment.dto';
import { AccountLedgerService } from './account-ledger.service';

@Injectable()
export class AccountAdjustmentsService {
  constructor(
    @InjectRepository(AccountAdjustment)
    private readonly accountAdjustmentRepo: Repository<AccountAdjustment>,
    private readonly accountLedgerService: AccountLedgerService
  ) {}

  async create(userScope: BranchScopedUser, dto: CreateAccountAdjustmentDto) {
    const branchId = resolveBranchScope(userScope, {
      requestedBranchId: dto.branchId,
      allowGlobal: false,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para crear ajustes de cuenta corriente',
      forbiddenMessage:
        'No tienes acceso a la sucursal solicitada para crear ajustes de cuenta corriente'
    });

    const adjustment = await this.accountAdjustmentRepo.save(
      this.accountAdjustmentRepo.create({
        branchId,
        customerId: dto.customerId,
        adjustmentType: dto.adjustmentType,
        direction: dto.direction,
        amount: dto.amount,
        reason: dto.reason,
        authorizedByUserId: dto.authorizedByUserId,
        createdByUserId: userScope.userId,
        notes: dto.notes
      })
    );

    const entry = await this.accountLedgerService.create(userScope, {
      customerId: dto.customerId,
      branchId,
      entryType:
        dto.direction === 'debit'
          ? AccountEntryType.ADJUSTMENT_DEBIT
          : AccountEntryType.ADJUSTMENT_CREDIT,
      entryDirection: dto.direction,
      amount: dto.amount,
      sourceModule: AccountEntrySourceModule.ACCOUNT,
      sourceEntityType: 'account_adjustment',
      sourceEntityId: adjustment.id,
      reasonCode: dto.adjustmentType,
      reasonText: dto.reason,
      notes: dto.notes
    });

    adjustment.entryId = entry.id;
    return this.accountAdjustmentRepo.save(adjustment);
  }
}
