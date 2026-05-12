import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { StockMovement, StockMovementType } from './entities/stock.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { User } from 'src/users/entities/user.entity';
import { StockService } from './stock.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';

@Injectable()
export class StockAdjustmentService {
  private readonly logger = new Logger(StockAdjustmentService.name);

  constructor(
    @InjectRepository(StockLocation)
    private readonly stockLocationRepo: Repository<StockLocation>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stockService: StockService
  ) {}

  async adjustStock(user: any, dto: CreateAdjustmentDto) {
    this.logger.log(
      `[ADJUSTMENT] User ${user.id} adjusting stock for variant ${dto.variantId} at branch ${dto.branchId}`
    );

    // 1. Validar variante
    const variant = await this.variantRepo.findOne({
      where: { id: dto.variantId }
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${dto.variantId} not found`);
    }

    // 2. Validar sucursal
    const branch = await this.branchRepo.findOne({
      where: { id: dto.branchId }
    });
    if (!branch) {
      throw new NotFoundException(`Branch ${dto.branchId} not found`);
    }

    // 3. Validar usuario
    const userEntity = await this.userRepo.findOne({
      where: { id: user.id }
    });
    if (!userEntity) {
      throw new NotFoundException(`User ${user.id} not found`);
    }

    // 4. Obtener stock actual
    const stockLocation = await this.stockLocationRepo
      .createQueryBuilder('stockLocation')
      .leftJoinAndSelect('stockLocation.productVariant', 'productVariant')
      .leftJoinAndSelect('stockLocation.branch', 'branch')
      .where('productVariant.id = :variantId', { variantId: dto.variantId })
      .andWhere('branch.id = :branchId', { branchId: dto.branchId })
      .getOne();

    const currentQuantity = stockLocation?.quantity || 0;
    const difference = dto.newQuantity - currentQuantity;

    // 3. Si no hay diferencia, no hacer nada
    if (difference === 0) {
      this.logger.log(
        `[ADJUSTMENT] No difference detected. Current: ${currentQuantity}, New: ${dto.newQuantity}`
      );
      return {
        message: 'No adjustment needed - quantities match',
        currentQuantity,
        newQuantity: dto.newQuantity,
        difference: 0
      };
    }

    // 4. Validar no negativo
    if (dto.newQuantity < 0) {
      throw new BadRequestException('Cannot adjust to negative quantity');
    }

    // 5. Calcular porcentaje de cambio para alerta
    const totalStock = await this.stockService.calculateTotalStock(dto.variantId);
    const percentageChange = totalStock > 0 ? (Math.abs(difference) / totalStock) * 100 : 100;

    // 6. Generar movimiento de ajuste
    const movement = this.stockMovementRepo.create({
      type: StockMovementType.ADJUSTMENT,
      quantity: difference,
      reason: dto.reason,
      variant,
      user: userEntity
    });

    await this.stockMovementRepo.save(movement);

    // 7. Actualizar StockLocation
    if (!stockLocation) {
      // Crear si no existe
      const newStockLocation = this.stockLocationRepo.create({
        productVariant: variant,
        branch: branch,
        quantity: dto.newQuantity,
        availableQuantity: dto.newQuantity
      });
      await this.stockLocationRepo.save(newStockLocation);
    } else {
      // Actualizar existente
      stockLocation.quantity = dto.newQuantity;
      stockLocation.availableQuantity = dto.newQuantity;
      await this.stockLocationRepo.save(stockLocation);
    }

    // 8. Verificar alerta de stock bajo después del ajuste
    await this.stockService.checkLowStock(dto.variantId);

    // 9. Alerta si ajuste > 20%
    const alert = percentageChange > 20 ? {
      type: 'LARGE_ADJUSTMENT',
      message: `Adjustment exceeds 20% of total stock (${percentageChange.toFixed(2)}%)`,
      variantId: dto.variantId,
      branchId: dto.branchId,
      percentageChange: percentageChange.toFixed(2)
    } : null;

    this.logger.log(
      `[ADJUSTMENT] Completed. Current: ${currentQuantity}, New: ${dto.newQuantity}, Diff: ${difference}, Change: ${percentageChange.toFixed(2)}%`
    );

    return {
      message: 'Stock adjusted successfully',
      previousQuantity: currentQuantity,
      newQuantity: dto.newQuantity,
      difference,
      percentageChange: percentageChange.toFixed(2),
      alert
    };
  }

  async getAdjustmentHistory(filters: { variantId?: string; branchId?: string } = {}) {
    const queryBuilder = this.stockMovementRepo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.variant', 'variant')
      .leftJoinAndSelect('movement.user', 'user')
      .where('movement.type = :type', { type: StockMovementType.ADJUSTMENT })
      .orderBy('movement.createdAt', 'DESC');

    if (filters.variantId) {
      queryBuilder.andWhere('variant.id = :variantId', { variantId: filters.variantId });
    }

    const movements = await queryBuilder.getMany();

    return movements.map(m => ({
      id: m.id,
      variantId: m.variant?.id,
      variantName: m.variant?.name,
      quantity: m.quantity,
      reason: m.reason,
      user: m.user ? `${m.user.firstname} ${m.user.lastname}` : 'System',
      createdAt: m.createdAt
    }));
  }
}
