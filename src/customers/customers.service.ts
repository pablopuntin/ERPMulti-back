import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CustomerBranch } from './entities/customer-branch.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  BranchScopedUser,
  ensureBranchAccess,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ScopedUser = BranchScopedUser;

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerBranch)
    private readonly customerBranchRepository: Repository<CustomerBranch>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>
  ) {}

  private normalizeBranchAssignments(
    userScope: ScopedUser,
    assignments?: Array<{ branchId: string; isDefault?: boolean }>
  ) {
    const activeBranchId = this.resolveOperationalBranchId(userScope);

    if (!activeBranchId) {
      throw new BadRequestException(
        'No hay una sucursal activa definida para guardar el cliente'
      );
    }

    ensureBranchAccess(
      userScope,
      activeBranchId,
      'No tienes acceso a la sucursal activa para operar clientes'
    );

    if (Array.isArray(assignments) && assignments.length > 0) {
      assignments.forEach((assignment) => {
        if (assignment.branchId !== activeBranchId) {
          throw new BadRequestException(
            'Los clientes solo pueden asignarse a la sucursal activa desde esta pantalla'
          );
        }
      });
    }

    return [
      {
        branchId: activeBranchId,
        isDefault: true
      }
    ];
  }

  private resolveOperationalBranchId(
    userScope: ScopedUser,
    requestedBranchId?: string
  ): string {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId,
      allowGlobal: false,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para operar clientes',
      forbiddenMessage: 'No tienes acceso a la sucursal seleccionada para clientes'
    });

    if (!resolvedBranchId) {
      throw new BadRequestException(
        'No hay una sucursal activa definida para operar clientes'
      );
    }

    return resolvedBranchId;
  }

  private assertCustomerBranchAccess(customer: Customer, branchId: string) {
    const hasActiveAssignment = (customer.branchAssignments || []).some(
      (assignment) =>
        assignment.isActive !== false && assignment.branchId === branchId
    );

    if (!hasActiveAssignment) {
      throw new NotFoundException('Customer not found');
    }
  }

  async create(userScope: ScopedUser, dto: CreateCustomerDto) {
    const normalizedAssignments = this.normalizeBranchAssignments(
      userScope,
      dto.branchAssignments
    );

    const customer = this.customerRepository.create({
      fullName: dto.fullName,
      document: dto.document,
      phone: dto.phone,
      email: dto.email,
      notes: dto.notes,
      isActive: true,
      isCreditEnabled: dto.isCreditEnabled ?? false,
      creditAutoRepriceBeforeFirstPayment:
        dto.creditAutoRepriceBeforeFirstPayment ?? true,
      creditPaymentTermDays: dto.creditPaymentTermDays ?? 0
    });

    const savedCustomer = await this.customerRepository.save(customer);

    await this.replaceBranchAssignments(savedCustomer.id, normalizedAssignments);

    return this.findOne(userScope, savedCustomer.id);
  }

  async findAll(userScope: ScopedUser, branchId?: string, search?: string) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope, branchId);
    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.branchAssignments', 'branchAssignment')
      .leftJoinAndSelect('branchAssignment.branch', 'branch')
      .where('customer.isActive = :isActive', { isActive: true })
      .orderBy('customer.fullName', 'ASC');

    qb.andWhere('branchAssignment.branchId = :branchId', {
      branchId: scopedBranchId
    });
    qb.andWhere('branchAssignment.isActive = :assignmentActive', {
      assignmentActive: true
    });

    if (search?.trim()) {
      const query = `%${search.trim()}%`;
      qb.andWhere(
        '(customer.fullName ILIKE :query OR customer.document ILIKE :query OR customer.phone ILIKE :query)',
        { query }
      );
    }

    return qb.getMany();
  }

  async findOne(userScope: ScopedUser, id: string, branchId?: string) {
    const scopedBranchId = this.resolveOperationalBranchId(userScope, branchId);
    const customer = await this.customerRepository.findOne({
      where: { id, isActive: true },
      relations: ['branchAssignments', 'branchAssignments.branch']
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    this.assertCustomerBranchAccess(customer, scopedBranchId);

    return customer;
  }

  async update(userScope: ScopedUser, id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(userScope, id);
    const normalizedAssignments = this.normalizeBranchAssignments(
      userScope,
      dto.branchAssignments
    );

    Object.assign(customer, {
      fullName: dto.fullName ?? customer.fullName,
      document: dto.document ?? customer.document,
      phone: dto.phone ?? customer.phone,
      email: dto.email ?? customer.email,
      notes: dto.notes ?? customer.notes,
      isCreditEnabled: dto.isCreditEnabled ?? customer.isCreditEnabled,
      creditAutoRepriceBeforeFirstPayment:
        dto.creditAutoRepriceBeforeFirstPayment ??
        customer.creditAutoRepriceBeforeFirstPayment,
      creditPaymentTermDays:
        dto.creditPaymentTermDays ?? customer.creditPaymentTermDays
    });

    await this.customerRepository.save(customer);

    await this.replaceBranchAssignments(customer.id, normalizedAssignments);

    return this.findOne(userScope, id);
  }

  async remove(userScope: ScopedUser, id: string) {
    const customer = await this.findOne(userScope, id);
    customer.isActive = false;
    await this.customerRepository.save(customer);
    return { deleted: true };
  }

  private async replaceBranchAssignments(
    customerId: string,
    assignments: Array<{ branchId: string; isDefault?: boolean }>
  ) {
    await this.customerBranchRepository.delete({ customerId });

    if (!assignments.length) {
      return;
    }

    const uniqueBranchIds = [
      ...new Set(assignments.map((assignment) => assignment.branchId))
    ];
    const branches = await this.branchRepository.find({
      where: uniqueBranchIds.map((id) => ({ id, isActive: true }))
    });
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));

    const entities = assignments
      .filter((assignment) => branchMap.has(assignment.branchId))
      .map((assignment, index) =>
        this.customerBranchRepository.create({
          customerId,
          branchId: assignment.branchId,
          isDefault: assignment.isDefault ?? index === 0,
          isActive: true
        })
      );

    if (entities.length > 0) {
      await this.customerBranchRepository.save(entities);
    }
  }
}
