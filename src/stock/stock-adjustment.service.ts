import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,
    private readonly stockService: StockService
  ) {}

  async adjustStock(user: any, dto: CreateAdjustmentDto) {
    return await this.dataSource.transaction(async (manager) => {
      this.logger.log(`[ADJUSTMENT] Starting transaction for Variant: ${dto.variantId} at Branch: ${dto.branchId}`);

      // 1. Validaciones previas (usando el manager de la transacción)
      const variant = await manager.findOne(ProductVariant, { where: { id: dto.variantId } });
      if (!variant) throw new NotFoundException(`Variant ${dto.variantId} not found`);

      const branch = await manager.findOne(Branch, { where: { id: dto.branchId } });
      if (!branch) throw new NotFoundException(`Branch ${dto.branchId} not found`);

      const userEntity = await manager.findOne(User, { where: { id: user.id } });
      if (!userEntity) throw new NotFoundException(`User ${user.id} not found`);

      // 2. Obtener ubicación de stock actual
      let stockLocation = await manager.findOne(StockLocation, {
        where: { 
          productVariant: { id: dto.variantId }, 
          branch: { id: dto.branchId } 
        }
      });

      const currentQuantity = stockLocation?.quantity || 0;
      const difference = dto.newQuantity - currentQuantity;

      if (difference === 0) {
        return { message: 'No adjustment needed', currentQuantity, difference: 0 };
      }

      if (dto.newQuantity < 0) {
        throw new BadRequestException('Cannot adjust to negative quantity');
      }

      // 3. Persistencia Atómica: Movimiento + Actualización de Stock
      const movement = manager.create(StockMovement, {
        type: StockMovementType.ADJUSTMENT,
        quantity: difference,
        previousQuantity: currentQuantity,
        newQuantity: dto.newQuantity,
        reason: dto.reason,
        variant,
        user: userEntity
      });

      // Guardamos el historial
      await manager.save(movement);

      // Actualizamos o creamos la ubicación de stock
      if (!stockLocation) {
        stockLocation = manager.create(StockLocation, {
          productVariant: variant,
          branch: branch,
          quantity: dto.newQuantity,
          availableQuantity: dto.newQuantity
        });
      } else {
        stockLocation.quantity = dto.newQuantity;
        stockLocation.availableQuantity = dto.newQuantity;
      }
      
      await manager.save(stockLocation);

      // 4. Lógica de alertas post-transacción (fuera del manager si no requieren atomicidad persistente)
      const totalStock = await this.stockService.calculateTotalStock(dto.variantId);
      const percentageChange = totalStock > 0 ? (Math.abs(difference) / totalStock) * 100 : 100;

      await this.stockService.checkLowStock(dto.variantId);

      const largeAdjustmentAlert = percentageChange > 20 ? {
        type: 'LARGE_ADJUSTMENT',
        message: `Adjustment exceeds 20% of total stock (${percentageChange.toFixed(2)}%)`,
      } : null;

      return {
        message: 'Stock adjusted successfully and history logged',
        previousQuantity: currentQuantity,
        newQuantity: dto.newQuantity,
        difference,
        alert: largeAdjustmentAlert
      };
    });
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
      variantName: m.variant?.name,
      previousQuantity: m.previousQuantity,
      newQuantity: m.newQuantity,
      difference: m.quantity,
      reason: m.reason,
      userName: m.user ? `${m.user.firstname} ${m.user.lastname}` : 'System',
      date: m.createdAt
    }));
  }
}