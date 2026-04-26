import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductVariant } from './entities/products-variant.entity';
import { CreateProductVariantDto } from './dto/create-products-variant.dto';
import { BulkUpdatePricesDto } from './dto/bulk-update-prices.dto';
import { BulkUpdateStockDto } from './dto/bulk-update-stock.dto';
import { ListProductVariantsDto } from './dto/list-product-variants.dto';
import { UpdateProductsVariantDto } from './dto/update-products-variant.dto';
import { ProductsBase } from 'src/products-base/entities/products-base.entity';
import { PriceHistoryService } from 'src/price-history/price-history.service';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { StockLocationType } from 'src/branches/entities/stock-location.entity';
import { Branch } from 'src/branches/entities/branch.entity';

@Injectable()
export class ProductsVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(ProductsBase)
    private readonly baseRepo: Repository<ProductsBase>,

    @InjectRepository(StockLocation)
    private readonly stockLocationRepo: Repository<StockLocation>,

    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,

    private readonly priceHistoryService: PriceHistoryService
  ) {}

  private async syncStockSalePrice(variantId: string, newPrice: number) {
    const stockLocations = await this.stockLocationRepo.find({
      where: {
        productVariant: { id: variantId },
        isActive: true
      }
    });

    if (stockLocations.length === 0) {
      return;
    }

    await this.stockLocationRepo.save(
      stockLocations.map((stockLocation) => ({
        ...stockLocation,
        salePrice: newPrice
      }))
    );
  }

  private buildStockKey(
    branchId?: string | null,
    locationType?: string | null
  ) {
    return `${locationType || StockLocationType.BRANCH}::${branchId || 'no-branch'}`;
  }

  private async syncVariantStocks(
    variant: ProductVariant,
    dto: UpdateProductsVariantDto
  ) {
    if (!dto.stocks) {
      return;
    }

    const existingStockLocations = await this.stockLocationRepo.find({
      where: {
        productVariant: { id: variant.id },
        isActive: true
      },
      relations: ['branch']
    });

    for (const stock of dto.stocks) {
      const locationType = (stock.locationType ||
        StockLocationType.BRANCH) as StockLocationType;
      const branchId = stock.branchId || null;

      if (locationType === StockLocationType.BRANCH && !branchId) {
        throw new BadRequestException(
          'Branch ID is required for branch stock locations'
        );
      }

      let branch: Branch | null = null;
      if (branchId) {
        branch = await this.branchRepo.findOne({
          where: { id: branchId, isActive: true }
        });

        if (!branch) {
          throw new BadRequestException(
            `Sucursal inválida para stock: ${branchId}`
          );
        }
      }

      const key = this.buildStockKey(branchId, locationType);
      const current = existingStockLocations.find(
        (item) => this.buildStockKey(item.branch?.id, item.locationType) === key
      );

      const quantity = Number(stock.quantity ?? 0);
      const reservedQuantity = Number(current?.reservedQuantity ?? 0);
      const nextAvailableQuantity = Math.max(quantity - reservedQuantity, 0);

      if (current) {
        current.quantity = quantity;
        current.availableQuantity = nextAvailableQuantity;
        current.minStock =
          stock.minStock ?? variant.minStock ?? current.minStock;
        current.locationType = locationType;
        current.branch = (branch ?? null) as any;
        current.salePrice = dto.price ?? variant.price;
        current.costPrice = dto.purchasePrice ?? variant.purchasePrice;
        current.sku = dto.sku ?? variant.sku;
        await this.stockLocationRepo.save(current);
        continue;
      }

      const created = this.stockLocationRepo.create({
        quantity,
        reservedQuantity: 0,
        availableQuantity: quantity,
        minStock: stock.minStock ?? variant.minStock ?? 5,
        locationType,
        sku: dto.sku ?? variant.sku,
        costPrice: dto.purchasePrice ?? variant.purchasePrice,
        salePrice: dto.price ?? variant.price,
        branch: branch ?? undefined,
        productVariant: variant,
        isActive: true
      });

      await this.stockLocationRepo.save(created);
    }
  }

  async create(dto: CreateProductVariantDto) {
    const base = await this.baseRepo.findOne({
      where: { id: dto.productBaseId }
    });
    if (!base) throw new NotFoundException('Producto base no encontrado');

    const variant = this.variantRepo.create({
      ...dto,
      purchasePrice: dto.purchasePrice ?? 0,
      productBase: base
    });

    return await this.variantRepo.save(variant);
  }

  async findAll() {
    return await this.variantRepo.find({
      relations: [
        'productBase',
        'category',
        'brand',
        'stockLocations',
        'stockLocations.branch'
      ],
      order: { name: 'ASC' }
    });
  }

  async findCatalog(query: ListProductVariantsDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));
    const search = query.search?.trim();

    const qb = this.variantRepo
      .createQueryBuilder('variant')
      .leftJoinAndSelect('variant.productBase', 'productBase')
      .leftJoinAndSelect('variant.category', 'category')
      .leftJoinAndSelect('variant.brand', 'brand')
      .where('variant.isActive = :isActive', { isActive: true });

    if (query.categoryId) {
      qb.andWhere('category.id = :categoryId', {
        categoryId: query.categoryId
      });
    }

    if (query.brandId) {
      qb.andWhere('brand.id = :brandId', { brandId: query.brandId });
    }

    if (query.productBaseId) {
      qb.andWhere('productBase.id = :productBaseId', {
        productBaseId: query.productBaseId
      });
    }

    if (query.variantId) {
      qb.andWhere('variant.id = :variantId', { variantId: query.variantId });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(variant.name) LIKE :search OR LOWER(variant.sku) LIKE :search OR LOWER(productBase.name) LIKE :search OR LOWER(category.name) LIKE :search OR LOWER(brand.name) LIKE :search)',
        { search: `%${search.toLowerCase()}%` }
      );
    }

    qb.orderBy('variant.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [variants, total] = await qb.getManyAndCount();

    const variantIds = variants.map((variant) => variant.id);
    const stockLocations =
      variantIds.length > 0
        ? await this.stockLocationRepo.find({
            where: {
              productVariant: { id: In(variantIds) },
              isActive: true
            },
            relations: ['branch', 'productVariant']
          })
        : [];

    const stockMap = new Map<string, StockLocation[]>();
    for (const stockLocation of stockLocations) {
      const stockVariantId = stockLocation.productVariant?.id;
      if (!stockVariantId) {
        continue;
      }

      const current = stockMap.get(stockVariantId) ?? [];
      current.push(stockLocation);
      stockMap.set(stockVariantId, current);
    }

    const items = variants.map((variant) => {
      const variantStocks = stockMap.get(variant.id) ?? [];
      const stockByBranch = variantStocks
        .filter((stock) => stock.isActive)
        .map((stock) => ({
          branchId: stock.branch?.id ?? null,
          branchName: stock.branch?.name ?? null,
          locationType: stock.locationType,
          locationLabel:
            stock.branch?.name ||
            (stock.locationType === StockLocationType.WAREHOUSE
              ? 'Depósito'
              : stock.locationType === StockLocationType.TRANSIT
                ? 'Tránsito'
                : stock.locationType === StockLocationType.PREORDER
                  ? 'Preventa'
                  : 'Ubicación'),
          quantity: Number(stock.quantity ?? 0),
          availableQuantity: Number(stock.availableQuantity ?? 0),
          reservedQuantity: Number(stock.reservedQuantity ?? 0),
          minStock: stock.minStock,
          isLowStock:
            Number(stock.availableQuantity ?? 0) <=
            Number(stock.minStock ?? variant.minStock ?? 5)
        }));

      const totalStock = variantStocks.reduce(
        (acc, stock) =>
          acc + Number(stock.availableQuantity ?? stock.quantity ?? 0),
        0
      );

      return {
        ...variant,
        stockByBranch,
        totalStock,
        stock: totalStock
      };
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1
      }
    };
  }

  async findOne(id: string) {
    const variant = await this.variantRepo.findOne({
      where: { id },
      relations: [
        'productBase',
        'category',
        'brand',
        'supplierProducts',
        'stockLocations',
        'stockLocations.branch'
      ]
    });
    if (!variant) throw new NotFoundException('Variante no encontrada');
    return variant;
  }

  async update(id: string, dto: UpdateProductsVariantDto, user?: any) {
    const variant = await this.variantRepo.findOne({
      where: { id },
      relations: [
        'productBase',
        'category',
        'brand',
        'stockLocations',
        'stockLocations.branch'
      ]
    });
    if (!variant)
      throw new NotFoundException(`Variante con id ${id} no encontrada`);

    const oldPrice = variant.price;
    const { stocks, ...variantFields } = dto;
    Object.assign(variant, variantFields);
    if (dto.purchasePrice === undefined && variant.purchasePrice === null) {
      variant.purchasePrice = 0;
    }
    const updated = await this.variantRepo.save(variant);

    await this.syncVariantStocks(updated, dto);

    if (dto.price !== undefined) {
      await this.syncStockSalePrice(id, updated.price);
    }

    if (dto.price !== undefined && dto.price !== oldPrice) {
      await this.priceHistoryService.recordChange({
        variant,
        oldPrice,
        newPrice: dto.price,
        changedBy: user ?? null,
        source: 'manual'
      });
    }

    return updated;
  }

  async bulkUpdatePrices(dto: BulkUpdatePricesDto) {
    if (!dto.variantIds?.length) {
      throw new BadRequestException('Debe enviar al menos una variante');
    }

    if (!Number.isFinite(dto.value)) {
      throw new BadRequestException('El valor del ajuste debe ser numérico');
    }

    const variants = await this.variantRepo.find({
      where: {
        id: In(dto.variantIds),
        isActive: true
      },
      relations: ['productBase', 'category', 'brand']
    });

    if (variants.length === 0) {
      throw new NotFoundException(
        'No se encontraron variantes activas para actualizar'
      );
    }

    const updatedVariants: ProductVariant[] = [];

    for (const variant of variants) {
      const oldPrice = Number(variant.price ?? 0);
      const baseValue =
        dto.base === 'purchasePrice'
          ? Number(variant.purchasePrice ?? 0)
          : oldPrice;

      const calculatedPrice =
        dto.mode === 'direct'
          ? dto.value
          : dto.mode === 'percentage'
            ? baseValue + (baseValue * dto.value) / 100
            : baseValue + dto.value;

      const nextPrice = Math.max(0, Number(calculatedPrice.toFixed(2)));

      variant.price = nextPrice;
      const savedVariant = await this.variantRepo.save(variant);
      await this.syncStockSalePrice(variant.id, nextPrice);

      if (nextPrice !== oldPrice) {
        await this.priceHistoryService.recordChange({
          variant: savedVariant,
          oldPrice,
          newPrice: nextPrice,
          changedBy: null,
          source: 'manual'
        });
      }

      updatedVariants.push(savedVariant);
    }

    return {
      updatedCount: updatedVariants.length,
      variants: updatedVariants
    };
  }

  async bulkUpdateStock(dto: BulkUpdateStockDto) {
    if (!dto.variantIds?.length) {
      throw new BadRequestException('Debe enviar al menos una variante');
    }

    if (!Number.isFinite(dto.value)) {
      throw new BadRequestException(
        'El valor del ajuste de stock debe ser numérico'
      );
    }

    const branch = await this.branchRepo.findOne({
      where: { id: dto.branchId, isActive: true }
    });

    if (!branch) {
      throw new BadRequestException(
        'La ubicación seleccionada no existe o está inactiva'
      );
    }

    const locationType = dto.locationType as StockLocationType;

    const variants = await this.variantRepo.find({
      where: {
        id: In(dto.variantIds),
        isActive: true
      },
      relations: ['stockLocations', 'stockLocations.branch']
    });

    if (variants.length === 0) {
      throw new NotFoundException(
        'No se encontraron variantes activas para actualizar stock'
      );
    }

    let updatedCount = 0;

    for (const variant of variants) {
      const current = (variant.stockLocations || []).find(
        (stockLocation) =>
          stockLocation.isActive &&
          stockLocation.locationType === locationType &&
          stockLocation.branch?.id === branch.id
      );

      const reservedQuantity = Number(current?.reservedQuantity ?? 0);
      const currentQuantity = Number(current?.quantity ?? 0);
      const nextQuantity =
        dto.mode === 'set'
          ? Number(dto.value)
          : currentQuantity + Number(dto.value);

      const normalizedQuantity = Math.max(0, nextQuantity);
      const nextAvailableQuantity = Math.max(
        normalizedQuantity - reservedQuantity,
        0
      );

      if (current) {
        current.quantity = normalizedQuantity;
        current.availableQuantity = nextAvailableQuantity;
        current.minStock =
          dto.minStock ?? current.minStock ?? variant.minStock ?? 5;
        current.locationType = locationType;
        current.branch = branch;
        current.sku = variant.sku;
        current.costPrice = variant.purchasePrice;
        current.salePrice = variant.price;
        current.isActive = true;
        await this.stockLocationRepo.save(current);
      } else {
        const created = this.stockLocationRepo.create({
          quantity: normalizedQuantity,
          reservedQuantity,
          availableQuantity: nextAvailableQuantity,
          minStock: dto.minStock ?? variant.minStock ?? 5,
          locationType,
          sku: variant.sku,
          costPrice: variant.purchasePrice,
          salePrice: variant.price,
          branch,
          productVariant: variant,
          isActive: true
        });

        await this.stockLocationRepo.save(created);
      }

      updatedCount += 1;
    }

    return {
      updatedCount,
      branchId: branch.id,
      branchName: branch.name,
      locationType,
      mode: dto.mode,
      value: dto.value
    };
  }

  async remove(id: string) {
    const variant = await this.variantRepo.findOne({ where: { id } });
    if (!variant)
      throw new NotFoundException(`Variante con id ${id} no encontrada`);

    variant.isActive = false;
    await this.variantRepo.save(variant);

    return { message: `Variante ${variant.name} desactivada correctamente` };
  }

  async getStockByBranch(variantId: string) {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId, isActive: true },
      relations: ['stockLocations', 'stockLocations.branch']
    });

    if (!variant) throw new NotFoundException('Variante no encontrada');

    return variant.stockLocations
      .filter((sl) => sl.isActive)
      .map((sl) => ({
        id: sl.id,
        locationType: sl.locationType,
        branchId: sl.branch?.id || null,
        branchName: sl.branch?.name || null,
        locationLabel:
          sl.branch?.name ||
          (sl.locationType === StockLocationType.WAREHOUSE
            ? 'Depósito'
            : sl.locationType === StockLocationType.TRANSIT
              ? 'Tránsito'
              : sl.locationType === StockLocationType.PREORDER
                ? 'Preventa'
                : 'Ubicación'),
        quantity: sl.quantity,
        availableQuantity: sl.availableQuantity,
        reservedQuantity: sl.reservedQuantity,
        minStock: sl.minStock,
        isLowStock: sl.availableQuantity <= (sl.minStock || 5)
      }));
  }
}
