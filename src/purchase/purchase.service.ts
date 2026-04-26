//MODULO DE COMPRAS POR SUPPLIER
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { User } from 'src/users/entities/user.entity';
import { StockService } from 'src/stock/stock.service';
import { StockMovementType } from 'src/stock/entities/stock.entity';
import { CashService } from 'src/cash/cash.service';
import { CashMovementType } from 'src/cash/entities/cash-movement.entity';
import {
  BranchScopedUser,
  resolveBranchScope
} from 'src/common/auth/branch-scope.util';

type ScopedUser = BranchScopedUser;

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepo: Repository<Purchase>,

    @InjectRepository(PurchaseItem)
    private purchaseItemRepo: Repository<PurchaseItem>,

    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,

    @InjectRepository(ProductVariant)
    private variantRepo: Repository<ProductVariant>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    private readonly stockService: StockService,
    private readonly cashService: CashService
  ) {}

  async create(userScope: ScopedUser, dto: CreatePurchaseDto) {
    const resolvedBranchId = resolveBranchScope(userScope, {
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para compras',
      forbiddenMessage: 'No tienes acceso a la sucursal de esta compra'
    });
    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId }
    });
    if (!supplier)
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    const items: PurchaseItem[] = [];
    let total = 0;

    for (const i of dto.items) {
      const variant = await this.variantRepo.findOne({
        where: { id: i.variantId }
      });
      if (!variant)
        throw new NotFoundException(`Variant ${i.variantId} not found`);

      const subtotal = i.quantity * i.cost;
      total += subtotal;

      // Entrada de stock
      await this.stockService.create({
        type: StockMovementType.ENTRY,
        variantId: variant.id,
        userId: user.id,
        quantity: i.quantity,
        reason: 'Compra'
      });

      items.push(
        this.purchaseItemRepo.create({
          variant,
          quantity: i.quantity,
          cost: i.cost,
          subtotal
        })
      );
    }

    // Crear compra
    const purchase = this.purchaseRepo.create({
      supplier,
      user,
      items,
      total,
      invoiceNumber: dto.invoiceNumber,
      notes: dto.notes
    });

    const saved = await this.purchaseRepo.save(purchase);

    // Apertura automática de caja
    const register = await this.cashService.getOrCreateOperationalRegister(
      userScope,
      resolvedBranchId,
      0
    );

    // Movimiento de gasto
    await this.cashService.createMovement(userScope, {
      registerId: register.id,
      amount: total,
      type: CashMovementType.EXPENSE,
      reason: `Compra a ${supplier.name} - ${saved.id}`
    });

    return saved;
  }

  findAll(_userScope: ScopedUser) {
    return this.purchaseRepo.find({
      relations: ['items', 'supplier', 'user']
    });
  }

  findOne(_userScope: ScopedUser, id: string) {
    return this.purchaseRepo.findOne({
      where: { id },
      relations: ['items', 'supplier', 'user']
    });
  }
}
