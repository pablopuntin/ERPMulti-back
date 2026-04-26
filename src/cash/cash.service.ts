import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CashRegister } from './entities/cash-register.entity';
import {
  CashMovement,
  CashMovementType
} from './entities/cash-movement.entity';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ScopedUser = BranchScopedUser;

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashRegister)
    private registerRepo: Repository<CashRegister>,
    @InjectRepository(CashMovement)
    private movementRepo: Repository<CashMovement>
  ) {}

  private isSameOperationalDay(date: Date | string, reference = new Date()) {
    const target = new Date(date);

    return (
      target.getFullYear() === reference.getFullYear()
      && target.getMonth() === reference.getMonth()
      && target.getDate() === reference.getDate()
    );
  }

  private calculateClosingBalance(register: CashRegister) {
    return register.movements.reduce(
      (sum, movement) =>
        movement.type === CashMovementType.INCOME
          ? sum + Number(movement.amount)
          : sum - Number(movement.amount),
      Number(register.openingBalance || 0)
    );
  }

  private async closeRegisterEntity(
    registerRepo: Repository<CashRegister>,
    register: CashRegister,
    closedAt = new Date()
  ) {
    if (register.isClosed) {
      return register;
    }

    register.closingBalance = this.calculateClosingBalance(register);
    register.isClosed = true;
    register.closedAt = closedAt;

    return registerRepo.save(register);
  }

  async getOrCreateOperationalRegister(
    user: ScopedUser,
    branchId?: string,
    openingBalance = 0
  ) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para la caja',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta caja'
    });

    return this.getOrCreateOperationalRegisterTx(
      this.registerRepo.manager,
      user,
      resolvedBranchId,
      openingBalance
    );
  }

  async getOrCreateOperationalRegisterTx(
    manager: EntityManager,
    user: ScopedUser,
    branchId?: string,
    openingBalance = 0
  ) {
    ensureBranchAccess(
      user,
      branchId,
      'No tienes acceso a la sucursal de esta caja'
    );

    const registerRepo = manager.getRepository(CashRegister);
    let register = await registerRepo.findOne({
      where: { isClosed: false, branchId },
      relations: ['movements'],
      order: { openedAt: 'DESC' }
    });

    if (register && !this.isSameOperationalDay(register.openedAt)) {
      await this.closeRegisterEntity(registerRepo, register);
      register = null;
    }

    if (!register) {
      register = registerRepo.create({
        openingBalance,
        branchId
      });
      register = await registerRepo.save(register);
      register.movements = [];
    }

    return register;
  }

  async openRegister(user: ScopedUser, branchId?: string, openingBalance = 0) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para la caja',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta caja'
    });
    const open = await this.registerRepo.findOne({
      where: { isClosed: false, branchId: resolvedBranchId },
      relations: ['movements'],
      order: { openedAt: 'DESC' }
    });

    if (open) {
      if (this.isSameOperationalDay(open.openedAt)) {
        throw new BadRequestException('A cash register is already open');
      }

      await this.closeRegisterEntity(this.registerRepo, open);
    }

    const register = this.registerRepo.create({
      openingBalance,
      branchId: resolvedBranchId
    });
    return this.registerRepo.save(register);
  }

  async closeRegister(user: ScopedUser, id: string) {
    const register = await this.registerRepo.findOne({
      where: { id },
      relations: ['movements']
    });
    if (!register) throw new NotFoundException('Register not found');
    if (register.isClosed)
      throw new BadRequestException('Register already closed');

    ensureBranchAccess(
      user,
      register.branchId,
      'No tienes acceso a la sucursal de esta caja'
    );

    return this.closeRegisterEntity(this.registerRepo, register);
  }

  async createMovement(user: ScopedUser, dto: CreateCashMovementDto) {
    const register = await this.registerRepo.findOne({
      where: { id: dto.registerId }
    });
    if (!register) throw new NotFoundException('Cash register not found');
    if (register.isClosed) throw new BadRequestException('Register is closed');

    ensureBranchAccess(
      user,
      register.branchId,
      'No tienes acceso a la sucursal de esta caja'
    );

    const movement = this.movementRepo.create({
      ...dto,
      register
    });

    return this.movementRepo.save(movement);
  }

  async getCurrentRegister(user: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para la caja',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta caja'
    });

    const register = await this.registerRepo.findOne({
      where: { isClosed: false, branchId: resolvedBranchId },
      relations: ['movements'],
      order: { openedAt: 'DESC' }
    });

    if (!register) {
      return null;
    }

    if (!this.isSameOperationalDay(register.openedAt)) {
      await this.closeRegisterEntity(this.registerRepo, register);
      return null;
    }

    return register;
  }

  async findRegisters(user: ScopedUser, branchId?: string) {
    const resolvedBranchId = resolveBranchScope(user, {
      requestedBranchId: branchId,
      allowGlobal: true,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para la caja',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta caja'
    });

    if (resolvedBranchId) {
      return this.registerRepo.find({
        where: { branchId: resolvedBranchId },
        relations: ['movements'],
        order: { openedAt: 'DESC' }
      });
    }

    return this.registerRepo.find({
      relations: ['movements'],
      order: { openedAt: 'DESC' }
    });
  }
}
