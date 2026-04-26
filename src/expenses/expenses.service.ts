import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FixedExpense } from './entities/fixed-expense.entity';
import { VariableExpense } from './entities/variable-expense.entity';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';
import { CreateVariableExpenseDto } from './dto/create-variable-expense.dto';
import { CashService } from 'src/cash/cash.service';
import { CashMovementType } from 'src/cash/entities/cash-movement.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ScopedUser = BranchScopedUser;

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(FixedExpense)
    private fixedRepo: Repository<FixedExpense>,

    @InjectRepository(VariableExpense)
    private variableRepo: Repository<VariableExpense>,

    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,

    private cashService: CashService
  ) {}

  async createFixed(
    userScope: ScopedUser,
    dto: CreateFixedExpenseDto,
    branchId?: string
  ) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para gastos',
      forbiddenMessage: 'No tienes acceso a los gastos de esta sucursal'
    });
    const supplier = dto.supplierId
      ? await this.supplierRepo.findOne({ where: { id: dto.supplierId } })
      : undefined;

    const expense = this.fixedRepo.create({
      ...dto,
      branchId: resolvedBranchId,
      ...(supplier ? { supplier } : {})
    });

    const saved = await this.fixedRepo.save(expense);

    const register = await this.cashService.getOrCreateOperationalRegister(
      userScope,
      resolvedBranchId,
      0
    );

    await this.cashService.createMovement(userScope, {
      registerId: register.id,
      type: CashMovementType.EXPENSE,
      amount: dto.amount,
      reason: `Gasto fijo: ${dto.name}`
    });

    return saved;
  }

  async createVariable(
    userScope: ScopedUser,
    dto: CreateVariableExpenseDto,
    branchId?: string
  ) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para gastos',
      forbiddenMessage: 'No tienes acceso a los gastos de esta sucursal'
    });
    const supplier = dto.supplierId
      ? await this.supplierRepo.findOne({ where: { id: dto.supplierId } })
      : undefined;

    const expense = this.variableRepo.create({
      ...dto,
      branchId: resolvedBranchId,
      ...(supplier ? { supplier } : {})
    });

    const saved = await this.variableRepo.save(expense);

    const register = await this.cashService.getOrCreateOperationalRegister(
      userScope,
      resolvedBranchId,
      0
    );

    await this.cashService.createMovement(userScope, {
      registerId: register.id,
      type: CashMovementType.EXPENSE,
      amount: dto.amount,
      reason: `Gasto variable: ${dto.name}`
    });

    return saved;
  }

  findAllFixed(userScope: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para gastos',
      forbiddenMessage: 'No tienes acceso a los gastos de esta sucursal'
    });

    return this.fixedRepo.find({
      where: resolvedBranchId ? { branchId: resolvedBranchId } : {},
      relations: ['supplier', 'branch'],
      order: { createdAt: 'DESC' }
    });
  }

  findAllVariable(userScope: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para gastos',
      forbiddenMessage: 'No tienes acceso a los gastos de esta sucursal'
    });

    return this.variableRepo.find({
      where: resolvedBranchId ? { branchId: resolvedBranchId } : {},
      relations: ['supplier', 'branch'],
      order: { createdAt: 'DESC' }
    });
  }

  async removeFixed(userScope: ScopedUser, id: string) {
    const item = await this.fixedRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Fixed expense not found');

    ensureBranchAccess(
      userScope,
      item.branchId,
      'No tienes acceso a los gastos de esta sucursal'
    );

    return this.fixedRepo.remove(item);
  }

  async removeVariable(userScope: ScopedUser, id: string) {
    const item = await this.variableRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Variable expense not found');

    ensureBranchAccess(
      userScope,
      item.branchId,
      'No tienes acceso a los gastos de esta sucursal'
    );

    return this.variableRepo.remove(item);
  }
}
