import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement, StockMovementType } from './entities/stock.entity';
import {
  StockTransfer,
  StockTransferStatus
} from './entities/stock-transfer.entity';
import { CreateStockMovementDto } from './dto/create-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { UpdateStockMovementDto } from './dto/update-stock.dto';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { Supplier } from 'src/suppliers/entities/supplier.entity';
import { User } from 'src/users/entities/user.entity';
import { StockAlert } from './entities/stock-alert.entity'; // ⚠️ Nueva entidad para alertas
import { Branch } from 'src/branches/entities/branch.entity';
import { ProductsBaseService } from 'src/products-base/products-base.service';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { StockLocationType } from 'src/branches/entities/stock-location.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly stockRepo: Repository<StockMovement>,

    @InjectRepository(StockTransfer)
    private readonly stockTransferRepo: Repository<StockTransfer>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,

    @InjectRepository(StockAlert)
    private readonly alertRepo: Repository<StockAlert>,

    @InjectRepository(StockLocation)
    private readonly stockLocationRepo: Repository<StockLocation>,

    private readonly productsBaseService: ProductsBaseService
  ) {}

  /** 🔍 Reutilizable: busca cualquier entidad o lanza excepción si no existe */
  private async findEntityOrFail<T extends { id: string }>(
    repo: Repository<T>,
    id: string,
    entityName: string
  ): Promise<T> {
    const found = await repo.findOne({ where: { id } as any });
    if (!found) throw new NotFoundException(`${entityName} ${id} not found`);
    return found;
  }

  private buildLocationKey(
    locationType: StockLocationType,
    branchId?: string | null
  ) {
    return `${locationType}::${branchId || 'no-branch'}`;
  }

  private async validateTransferLocation(
    locationType: StockLocationType,
    branchId?: string
  ) {
    if (locationType === StockLocationType.BRANCH && !branchId) {
      throw new BadRequestException(
        'Las ubicaciones de tipo sucursal requieren branchId'
      );
    }

    if (branchId) {
      const branch = await this.branchRepo.findOne({
        where: { id: branchId, isActive: true }
      });
      if (!branch) {
        throw new BadRequestException(`Sucursal inválida: ${branchId}`);
      }
      return branch;
    }

    return null;
  }

  async getBranchAvailableStockMap(variantIds: string[], branchId?: string) {
    if (!branchId || !variantIds.length) {
      return new Map<string, number>();
    }

    const uniqueVariantIds = [...new Set(variantIds.filter(Boolean))];

    if (!uniqueVariantIds.length) {
      return new Map<string, number>();
    }

    const locations = await this.stockLocationRepo.find({
      where: uniqueVariantIds.map((variantId) => ({
        productVariant: { id: variantId },
        branch: { id: branchId },
        isActive: true,
        locationType: StockLocationType.BRANCH
      })),
      relations: ['productVariant', 'branch']
    });

    return new Map(
      locations.map((location) => [
        location.productVariant.id,
        Number(location.availableQuantity ?? location.quantity ?? 0)
      ])
    );
  }

  async reserveStock(
    variantId: string,
    branchId: string | undefined,
    userId: string,
    quantity: number,
    reason?: string
  ) {
    if (!quantity || quantity <= 0) {
      return null;
    }

    const variant = await this.findEntityOrFail(
      this.variantRepo,
      variantId,
      'Variant'
    );
    const user = await this.findEntityOrFail(this.userRepo, userId, 'User');

    const stockLocation = await this.stockLocationRepo.findOne({
      where: {
        productVariant: { id: variantId },
        branch: branchId ? { id: branchId } : undefined,
        isActive: true,
        locationType: StockLocationType.BRANCH
      },
      relations: ['branch', 'productVariant']
    });

    if (!stockLocation) {
      throw new BadRequestException(
        `No se encontró stock de sucursal para ${variant.name}`
      );
    }

    const availableQuantity = Number(
      stockLocation.availableQuantity ?? stockLocation.quantity ?? 0
    );
    if (availableQuantity < quantity) {
      throw new BadRequestException(
        `Not enough stock for ${variant.name}. Current available: ${availableQuantity}, trying to reserve: ${quantity}`
      );
    }

    stockLocation.reservedQuantity =
      Number(stockLocation.reservedQuantity ?? 0) + quantity;
    stockLocation.availableQuantity = Math.max(
      Number(stockLocation.quantity ?? 0) -
        Number(stockLocation.reservedQuantity ?? 0),
      0
    );
    await this.stockLocationRepo.save(stockLocation);

    const movement = this.stockRepo.create({
      type: StockMovementType.RESERVE,
      quantity,
      reason,
      variant,
      user
    });

    return this.stockRepo.save(movement);
  }

  async releaseReservedStock(
    variantId: string,
    branchId: string | undefined,
    userId: string,
    quantity: number,
    reason?: string
  ) {
    if (!quantity || quantity <= 0) {
      return null;
    }

    const variant = await this.findEntityOrFail(
      this.variantRepo,
      variantId,
      'Variant'
    );
    const user = await this.findEntityOrFail(this.userRepo, userId, 'User');

    const stockLocation = await this.stockLocationRepo.findOne({
      where: {
        productVariant: { id: variantId },
        branch: branchId ? { id: branchId } : undefined,
        isActive: true,
        locationType: StockLocationType.BRANCH
      },
      relations: ['branch', 'productVariant']
    });

    if (!stockLocation) {
      return null;
    }

    const currentReserved = Number(stockLocation.reservedQuantity ?? 0);
    const releaseQuantity = Math.min(currentReserved, quantity);
    if (releaseQuantity <= 0) {
      return null;
    }

    stockLocation.reservedQuantity = Math.max(
      currentReserved - releaseQuantity,
      0
    );
    stockLocation.availableQuantity = Math.max(
      Number(stockLocation.quantity ?? 0) -
        Number(stockLocation.reservedQuantity ?? 0),
      0
    );
    await this.stockLocationRepo.save(stockLocation);

    const movement = this.stockRepo.create({
      type: StockMovementType.RELEASE,
      quantity: releaseQuantity,
      reason,
      variant,
      user
    });

    return this.stockRepo.save(movement);
  }

  async consumeReservedStock(
    variantId: string,
    branchId: string | undefined,
    userId: string,
    quantity: number,
    reason?: string
  ) {
    if (!quantity || quantity <= 0) {
      return null;
    }

    const variant = await this.findEntityOrFail(
      this.variantRepo,
      variantId,
      'Variant'
    );
    const user = await this.findEntityOrFail(this.userRepo, userId, 'User');

    const stockLocation = await this.stockLocationRepo.findOne({
      where: {
        productVariant: { id: variantId },
        branch: branchId ? { id: branchId } : undefined,
        isActive: true,
        locationType: StockLocationType.BRANCH
      },
      relations: ['branch', 'productVariant']
    });

    if (!stockLocation) {
      throw new BadRequestException(
        `No se encontró stock reservado para ${variant.name}`
      );
    }

    const currentReserved = Number(stockLocation.reservedQuantity ?? 0);
    if (currentReserved < quantity) {
      throw new BadRequestException(
        `Reserved stock insufficient for ${variant.name}. Reserved: ${currentReserved}, trying to consume: ${quantity}`
      );
    }

    const currentQuantity = Number(stockLocation.quantity ?? 0);
    if (currentQuantity < quantity) {
      throw new BadRequestException(
        `Physical stock insufficient for ${variant.name}. Current: ${currentQuantity}, trying to remove: ${quantity}`
      );
    }

    stockLocation.quantity = currentQuantity - quantity;
    stockLocation.reservedQuantity = currentReserved - quantity;
    stockLocation.availableQuantity = Math.max(
      Number(stockLocation.quantity ?? 0) -
        Number(stockLocation.reservedQuantity ?? 0),
      0
    );
    await this.stockLocationRepo.save(stockLocation);

    const movement = this.stockRepo.create({
      type: StockMovementType.EXIT,
      quantity,
      reason,
      variant,
      user
    });

    return this.stockRepo.save(movement);
  }

  async transfer(dto: TransferStockDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException(
        'La cantidad a transferir debe ser mayor a cero'
      );
    }

    const fromLocationType = dto.from.locationType;
    const toLocationType = dto.to.locationType;
    const fromBranchId = dto.from.branchId;
    const toBranchId = dto.to.branchId;

    const sameLocation =
      this.buildLocationKey(fromLocationType, fromBranchId) ===
      this.buildLocationKey(toLocationType, toBranchId);
    if (sameLocation) {
      throw new BadRequestException(
        'El origen y destino no pueden ser la misma ubicación'
      );
    }

    const variant = await this.findEntityOrFail(
      this.variantRepo,
      dto.variantId,
      'Variant'
    );
    const user = dto.userId
      ? await this.findEntityOrFail(this.userRepo, dto.userId, 'User')
      : null;

    const fromBranch = await this.validateTransferLocation(
      fromLocationType,
      fromBranchId
    );
    const toBranch = await this.validateTransferLocation(
      toLocationType,
      toBranchId
    );

    return this.stockRepo.manager.transaction(async (manager) => {
      const stockLocationRepo = manager.getRepository(StockLocation);
      const stockMovementRepo = manager.getRepository(StockMovement);
      const stockTransferRepo = manager.getRepository(StockTransfer);

      const locations = await stockLocationRepo.find({
        where: {
          productVariant: { id: dto.variantId },
          isActive: true
        },
        relations: ['branch', 'productVariant']
      });

      const fromLocation = locations.find(
        (location) =>
          this.buildLocationKey(location.locationType, location.branch?.id) ===
          this.buildLocationKey(fromLocationType, fromBranchId)
      );

      if (!fromLocation) {
        throw new NotFoundException(
          'No se encontró stock en la ubicación de origen'
        );
      }

      if (
        Number(fromLocation.availableQuantity ?? fromLocation.quantity ?? 0) <
        dto.quantity
      ) {
        throw new BadRequestException(
          `Stock insuficiente en origen. Disponible: ${fromLocation.availableQuantity ?? fromLocation.quantity}`
        );
      }

      let toLocation = locations.find(
        (location) =>
          this.buildLocationKey(location.locationType, location.branch?.id) ===
          this.buildLocationKey(toLocationType, toBranchId)
      );

      const originQuantityBefore = Number(fromLocation.quantity ?? 0);
      const originAvailableBefore = Number(
        fromLocation.availableQuantity ?? fromLocation.quantity ?? 0
      );
      const destinationQuantityBefore = Number(toLocation?.quantity ?? 0);
      const destinationAvailableBefore = Number(
        toLocation?.availableQuantity ?? toLocation?.quantity ?? 0
      );

      fromLocation.quantity = Number(fromLocation.quantity) - dto.quantity;
      fromLocation.availableQuantity = Math.max(
        originAvailableBefore - dto.quantity,
        0
      );
      await stockLocationRepo.save(fromLocation);

      if (!toLocation) {
        toLocation = stockLocationRepo.create({
          quantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          minStock: fromLocation.minStock,
          locationType: toLocationType,
          sku: fromLocation.sku || variant.sku,
          costPrice: fromLocation.costPrice,
          salePrice: fromLocation.salePrice ?? variant.price,
          branch: toBranch ?? undefined,
          productVariant: variant,
          isActive: true
        });
      }

      toLocation.quantity = destinationQuantityBefore + dto.quantity;
      toLocation.availableQuantity = destinationAvailableBefore + dto.quantity;
      toLocation.minStock =
        toLocation.minStock ?? fromLocation.minStock ?? variant.minStock;
      toLocation.locationType = toLocationType;
      toLocation.branch = toBranch ?? undefined;
      toLocation.sku = toLocation.sku || fromLocation.sku || variant.sku;
      toLocation.costPrice = toLocation.costPrice ?? fromLocation.costPrice;
      toLocation.salePrice =
        toLocation.salePrice ?? fromLocation.salePrice ?? variant.price;
      toLocation.isActive = true;
      await stockLocationRepo.save(toLocation);

      if (user) {
        const movement = stockMovementRepo.create({
          type: StockMovementType.ADJUSTMENT,
          quantity: dto.quantity,
          reason:
            dto.reason ||
            `Transferencia ${fromLocationType}${fromBranch?.name ? ` ${fromBranch.name}` : ''} -> ${toLocationType}${toBranch?.name ? ` ${toBranch.name}` : ''}`,
          variant,
          user
        });

        await stockMovementRepo.save(movement);
      }

      const transfer = stockTransferRepo.create({
        status: StockTransferStatus.COMPLETED,
        fromLocationType,
        toLocationType,
        quantity: dto.quantity,
        reason: dto.reason || null,
        originQuantityBefore,
        originQuantityAfter: Number(fromLocation.quantity ?? 0),
        destinationQuantityBefore,
        destinationQuantityAfter: Number(toLocation.quantity ?? 0),
        completedAt: new Date(),
        variant,
        createdBy: user,
        fromBranch,
        toBranch
      });

      const savedTransfer = await stockTransferRepo.save(transfer);

      return {
        message: 'Transferencia realizada correctamente',
        transferId: savedTransfer.id,
        variantId: dto.variantId,
        quantity: dto.quantity,
        from: {
          locationType: fromLocationType,
          branchId: fromBranchId || null,
          remainingQuantity: fromLocation.quantity,
          remainingAvailableQuantity: fromLocation.availableQuantity
        },
        to: {
          locationType: toLocationType,
          branchId: toBranchId || null,
          quantity: toLocation.quantity,
          availableQuantity: toLocation.availableQuantity
        }
      };
    });
  }

  findAllTransfers(): Promise<StockTransfer[]> {
    return this.stockTransferRepo.find({
      order: { createdAt: 'DESC' }
    });
  }

  async findTransferById(id: string): Promise<StockTransfer> {
    const transfer = await this.stockTransferRepo.findOne({
      where: { id }
    });

    if (!transfer) {
      throw new NotFoundException(`StockTransfer ${id} not found`);
    }

    return transfer;
  }

  /** 🏗️ Crea un movimiento de stock (entrada/salida/ajuste) */
  async create(dto: CreateStockMovementDto): Promise<StockMovement> {
    const variant = await this.findEntityOrFail(
      this.variantRepo,
      dto.variantId,
      'Variant'
    );
    const user = await this.findEntityOrFail(this.userRepo, dto.userId, 'User');
    const supplier = dto.supplierId
      ? await this.findEntityOrFail(
          this.supplierRepo,
          dto.supplierId,
          'Supplier'
        )
      : undefined;

    // 🧮 Obtener stock actual desde StockLocations
    const currentStock = await this.productsBaseService.calculateTotalStock(
      dto.variantId
    );

    // 🧮 Validar y ajustar stock según el movimiento
    if (dto.type === StockMovementType.EXIT) {
      if (currentStock < dto.quantity) {
        throw new BadRequestException(
          `Not enough stock for ${variant.name}. Current: ${currentStock}, trying to remove: ${dto.quantity}`
        );
      }
    }

    // 🧩 Si no tiene minStock definido, por defecto 5
    if (variant.minStock === null || variant.minStock === undefined) {
      variant.minStock = 5;
    }

    // 🚨 Crear movimiento
    const movement = this.stockRepo.create({
      type: dto.type,
      quantity: dto.quantity,
      reason: dto.reason,
      variant,
      user,
      supplier
    });

    await this.stockRepo.save(movement);

    // 📢 Verificar stock bajo DESPUÉS del movimiento
    const newStock =
      dto.type === StockMovementType.ENTRY
        ? currentStock + dto.quantity
        : dto.type === StockMovementType.EXIT
          ? currentStock - dto.quantity
          : dto.quantity;

    // 🚨 Usar nuevo método de verificación de stock bajo
    const stockCheck = await this.productsBaseService.checkLowStock(
      dto.variantId
    );

    // 📢 Crear alertas para cada ubicación con stock bajo y stock total bajo
    if (stockCheck.alerts.length > 0) {
      for (const alertMessage of stockCheck.alerts) {
        await this.createLowStockAlert(variant, alertMessage, newStock);
      }
    }

    return movement;
  }

  /** 🚨 Crear alerta de stock bajo (mejorado) */
  private async createLowStockAlert(
    variant: ProductVariant,
    alertMessage: string,
    currentStock: number
  ) {
    const alert = this.alertRepo.create({
      variant,
      currentStock,
      minStock: variant.minStock,
      message: alertMessage
    });
    await this.alertRepo.save(alert);
  }

  /** 📜 Listar todos los movimientos */
  findAll(): Promise<StockMovement[]> {
    return this.stockRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['variant', 'user', 'supplier']
    });
  }

  /** 🔍 Buscar un movimiento por ID */
  async findOne(id: string): Promise<StockMovement> {
    const movement = await this.stockRepo.findOne({
      where: { id },
      relations: ['variant', 'user', 'supplier']
    });
    if (!movement) throw new NotFoundException(`StockMovement ${id} not found`);
    return movement;
  }

  /** ✏️ Actualizar un movimiento */
  async update(id: string, dto: UpdateStockMovementDto) {
    await this.stockRepo.update(id, dto);
    return this.findOne(id);
  }

  /** 🗑️ Eliminar un movimiento */
  async remove(id: string) {
    const movement = await this.findOne(id);
    await this.stockRepo.remove(movement);
  }

  /** 🚨 Obtener alertas activas */
  async getActiveAlerts() {
    return this.alertRepo.find({
      where: { resolved: false },
      relations: ['variant'],
      order: { createdAt: 'DESC' }
    });
  }

  /** ✅ Resolver alerta (cuando se repone stock) */
  async resolveAlert(variantId: string) {
    const alerts = await this.alertRepo.find({
      where: { variant: { id: variantId }, resolved: false }
    });
    for (const alert of alerts) {
      alert.resolved = true;
      await this.alertRepo.save(alert);
    }
  }
}
