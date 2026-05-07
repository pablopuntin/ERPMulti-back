import { CreateProductBaseSimpleDto } from './dto/create-product-base-simple.dto';
import { AddVariantWithStocksDto } from './dto/add-variant-with-stocks.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsBase } from './entities/products-base.entity';
import { Brand } from 'src/brands/entities/brand.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { StockLocationType } from 'src/branches/entities/stock-location.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { Category } from 'src/categories/entities/category.entity';
import { PreviewProductsImportDto } from './dto/preview-products-import.dto';
import { resolveBranchScope, type BranchScopedUser } from 'src/common/auth/branch-scope.util';
import { StockService } from 'src/stock/stock.service';
import { ProductImportService } from './product-import.service';

@Injectable()
export class ProductsBaseService {
  constructor(
    @InjectRepository(ProductsBase)
    private readonly productsBaseRepository: Repository<ProductsBase>,

    @InjectRepository(Brand)
    private readonly brandsRepository: Repository<Brand>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,

    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,

    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,

    @Inject(forwardRef(() => StockService))
    private readonly stockService: StockService,

    private readonly productImportService: ProductImportService
  ) {}

  private resolveOperationalBranchId(
    userScope: BranchScopedUser,
    requestedBranchId?: string
  ): string {
    const resolvedBranchId = resolveBranchScope(userScope, {
      requestedBranchId,
      allowGlobal: false,
      missingActiveBranchMessage:
        'No hay una sucursal activa definida para operar productos',
      forbiddenMessage:
        'No tienes acceso a la sucursal seleccionada para productos'
    });

    if (!resolvedBranchId) {
      throw new BadRequestException(
        'No hay una sucursal activa definida para operar productos'
      );
    }

    return resolvedBranchId;
  }

  private async ensureVariantAssignment(
    variant: ProductVariant,
    branchId: string,
    branch?: Branch | null
  ) {
    return this.stockService.ensureVariantAssignment(variant, branchId, branch);
  }

  async previewImportFile(userScope: BranchScopedUser, fileBuffer: Buffer) {
    return this.productImportService.previewImportFile(userScope, fileBuffer);
  }

  async importProductsFile(userScope: BranchScopedUser, fileBuffer: Buffer) {
    return this.productImportService.importProductsFile(userScope, fileBuffer);
  }

  async importProducts(userScope: BranchScopedUser, dto: PreviewProductsImportDto) {
    return this.productImportService.importProducts(userScope, dto);
  }

  async previewImport(userScope: BranchScopedUser, dto: PreviewProductsImportDto) {
    return this.productImportService.previewImport(userScope, dto);
  }

  private formatCsvDecimal(value: unknown) {
    return this.productImportService.formatCsvDecimal(value);
  }

  private formatCsvInteger(value: unknown) {
    return this.productImportService.formatCsvInteger(value);
  }

  private escapeCsvValue(value: unknown) {
    return this.productImportService.escapeCsvValue(value);
  }


  // ---------------------------------------------------------------------------
  // CREATE SIMPLE - Solo ProductBase sin variantes
  // ---------------------------------------------------------------------------
  async createSimple(dto: CreateProductBaseSimpleDto) {
    const [brand, category] = await Promise.all([
      this.brandsRepository.findOne({
        where: { id: dto.brandId, isActive: true }
      }),
      this.categoriesRepository.findOne({
        where: { id: dto.categoryId, isActive: true }
      })
    ]);

    if (!brand) {
      throw new NotFoundException(
        `Brand with ID ${dto.brandId} not found or inactive`
      );
    }

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${dto.categoryId} not found or inactive`
      );
    }

    const productBase = this.productsBaseRepository.create({
      name: dto.name,
      description: dto.description,
      brand,
      category, // Agregar categoría
      isActive: dto.isActive ?? true
    });

    return await this.productsBaseRepository.save(productBase);
  }

  // ---------------------------------------------------------------------------
  // ADD VARIANT - Agregar variante a ProductBase existente
  // ---------------------------------------------------------------------------
  async addVariantToProductBase(
    userScope: BranchScopedUser,
    productBaseId: string,
    variantData: {
      name: string;
      price: number;
      purchasePrice?: number;
      stock: number;
      sku?: string;
      minStock?: number;
      branchId?: string;
    }
  ) {
    // 1️⃣ Verificar que existe el ProductBase con relaciones
    const productBase = await this.productsBaseRepository.findOne({
      where: { id: productBaseId, isActive: true },
      relations: ['brand', 'category']
    });

    if (!productBase) {
      throw new NotFoundException('Product base not found or inactive');
    }

    const operationalBranchId = this.resolveOperationalBranchId(
      userScope,
      variantData.branchId
    );

    // 2️⃣ Generar SKU automático si no se proporciona
    const generatedSku =
      variantData.sku ||
      this.generateSKU(productBase.name, productBase.brand?.name || 'GEN');
    const resolvedVariantName = variantData.name?.trim() || productBase.name;

    // 3️⃣ Crear la variante
    const newVariant = this.variantsRepository.create({
      name: resolvedVariantName,
      price: variantData.price,
      purchasePrice: variantData.purchasePrice ?? 0,
      minStock: variantData.minStock || 5,
      imgURL:
        'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
      sku: generatedSku,
      productBase: productBase,
      isActive: true
    });

    const savedVariant = await this.variantsRepository.save(newVariant);
    await this.ensureVariantAssignment(savedVariant, operationalBranchId);

    // 4️⃣ Crear StockLocation si se especificó sucursal
    let stockLocation: StockLocation | null = null;
    if (variantData.branchId || variantData.stock > 0) {
      stockLocation = await this.stockService.createStockLocation({
        variantId: savedVariant.id,
        branchId: operationalBranchId,
        quantity: variantData.stock,
        minStock: variantData.minStock || 5,
        locationType: StockLocationType.BRANCH,
        sku: generatedSku,
        costPrice: variantData.purchasePrice ?? variantData.price * 0.7,
        salePrice: variantData.price
      });
    }

    return {
      productBase,
      variant: savedVariant,
      stockLocation,
      message:
        'Variante agregada exitosamente' +
        (stockLocation ? ' con stock en sucursal' : '')
    };
  }

  // ---------------------------------------------------------------------------
  // GENERADOR DE SKU AUTOMÁTICO
  // ---------------------------------------------------------------------------
  private generateSKU(productName: string, brandName: string): string {
    const prefix = brandName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    const suffix = productName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${suffix}-${random}`;
  }

  // ---------------------------------------------------------------------------
  // MÉTODO AUXILIAR - Verificar stock bajo por ubicación y total
  // ---------------------------------------------------------------------------
  async checkLowStock(variantId: string) {
    return this.stockService.checkLowStock(variantId);
  }

  // ---------------------------------------------------------------------------
  // MÉTODO AUXILIAR - Calcular stock total (sucursales + depositos, sin tránsito)
  // ---------------------------------------------------------------------------
  async calculateTotalStock(variantId: string): Promise<number> {
    return this.stockService.calculateTotalStock(variantId);
  }

  // ---------------------------------------------------------------------------
  // MÉTODO AUXILIAR - Calcular stock por sucursal específica
  // ---------------------------------------------------------------------------
  async calculateStockByBranch(
    variantId: string,
    branchId: string
  ): Promise<number> {
    return this.stockService.calculateStockByBranch(variantId, branchId);
  }

  // ---------------------------------------------------------------------------
  // FIND ALL
  // ---------------------------------------------------------------------------
  async findAll(
    userScope: BranchScopedUser,
    includeInactive = false,
    branchId?: string
  ) {
    const resolvedBranchId = this.resolveOperationalBranchId(userScope, branchId);

    const qb = this.productsBaseRepository
      .createQueryBuilder('productBase')
      .leftJoinAndSelect('productBase.brand', 'brand')
      .leftJoinAndSelect('productBase.variants', 'variant')
      .innerJoin('variant.branchAssignments', 'branchAssignment')
      .where(includeInactive ? '1=1' : 'productBase.isActive = :isActive', {
        isActive: true
      })
      .andWhere('variant.isActive = :variantActive', { variantActive: true })
      .andWhere('branchAssignment.branchId = :branchId', {
        branchId: resolvedBranchId
      })
      .andWhere('branchAssignment.isActive = :assignmentActive', {
        assignmentActive: true
      })
      .orderBy('productBase.name', 'ASC');

    return qb.getMany();
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------
  async findOne(id: string, includeInactive = false) {
    const product = await this.productsBaseRepository.findOne({
      where: includeInactive ? { id } : { id, isActive: true },
      relations: [
        'brand',
        'category',
        'variants',
        'variants.stockLocations',
        'variants.stockLocations.branch'
      ]
    });

    if (!product) {
      throw new NotFoundException('Product base not found');
    }

    return product;
  }

  async exportImportTemplateCsv(
    userScope: BranchScopedUser,
    branchId?: string
  ) {
    const resolvedBranchId = this.resolveOperationalBranchId(userScope, branchId);
    const branch = await this.branchesRepository.findOne({
      where: { id: resolvedBranchId, isActive: true }
    });

    if (!branch) {
      throw new BadRequestException('La sucursal solicitada no existe o está inactiva');
    }

    const productBases = await this.findAll(userScope, false, resolvedBranchId);
    const fullProducts = await Promise.all(
      productBases.map((productBase) => this.findOne(productBase.id))
    );

    const headers = [
      'categoria',
      'marca',
      'producto_base',
      'variante',
      'sku',
      'descripcion',
      'precio_compra',
      'precio_venta',
      'stock_minimo',
      'sucursal',
      'tipo_ubicacion',
      'ubicacion',
      'stock',
      'grupo',
      'subgrupo'
    ];

    const rows = fullProducts.flatMap((productBase) => {
      const activeVariants = (productBase.variants || []).filter((variant) =>
        variant.isActive
      );

      return activeVariants.map((variant) => {
        const matchingStock = (variant.stockLocations || []).find(
          (stockLocation) =>
            stockLocation.isActive &&
            stockLocation.locationType === StockLocationType.BRANCH &&
            stockLocation.branch?.id === branch.id
        );

        return [
          productBase.category?.name || '',
          productBase.brand?.name || '',
          productBase.name || '',
          variant.name || productBase.name || '',
          variant.sku || '',
          productBase.description || '',
          this.formatCsvDecimal(variant.purchasePrice ?? 0),
          this.formatCsvDecimal(variant.price ?? 0),
          this.formatCsvInteger(matchingStock?.minStock ?? variant.minStock ?? 5),
          branch.name,
          'branch',
          branch.name,
          this.formatCsvInteger(
            matchingStock?.availableQuantity ?? matchingStock?.quantity ?? 0
          ),
          '',
          ''
        ];
      });
    });

    const csvLines = [headers, ...rows].map((row) =>
      row.map((value) => this.escapeCsvValue(value)).join(',')
    );

    return `\uFEFF${csvLines.join('\n')}`;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------
  async update(id: string, dto: any) {
    const productBase = await this.productsBaseRepository.findOne({
      where: { id },
      relations: ['brand', 'category']
    });

    if (!productBase) {
      throw new NotFoundException('Product base not found');
    }

    const { name, description, brandId, categoryId } = dto;

    if (categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: { id: categoryId, isActive: true }
      });

      if (!category) {
        throw new BadRequestException('Category not found or inactive');
      }

      productBase.category = category;
    }

    if (brandId) {
      const brand = await this.brandsRepository.findOne({
        where: { id: brandId, isActive: true }
      });

      if (!brand) {
        throw new BadRequestException('Brand not found or inactive');
      }

      productBase.brand = brand;
    }

    if (name !== undefined) productBase.name = name;
    if (description !== undefined) productBase.description = description;

    return await this.productsBaseRepository.save(productBase);
  }

  // ---------------------------------------------------------------------------
  // LOGICAL DELETE
  // ---------------------------------------------------------------------------
  async deactivate(id: string) {
    const productBase = await this.productsBaseRepository.findOne({
      where: { id, isActive: true },
      relations: ['variants']
    });

    if (!productBase) {
      throw new NotFoundException('Product base not found or already inactive');
    }

    // 🔥 1. Desactivar el producto base
    productBase.isActive = false;
    await this.productsBaseRepository.save(productBase);

    // 🔥 2. Desactivar también todas sus variantes
    await this.variantsRepository.update(
      { productBase: { id } },
      { isActive: false }
    );

    return { message: 'Product base and variants deactivated', id };
  }

  //metodo para obtener una variante asociado a un productbase
  async findVariantsByProductBase(productBaseId: string) {
    const productBase = await this.productsBaseRepository.findOne({
      where: { id: productBaseId, isActive: true },
      relations: ['variants']
    });

    if (!productBase) {
      throw new NotFoundException('Producto base no encontrado');
    }

    return productBase.variants.filter((v) => v.isActive);
  }

  // ---------------------------------------------------------------------------
  // ADD VARIANT WITH STOCKS - Nueva versión con múltiples stocks
  // ---------------------------------------------------------------------------
  async addVariantWithStocks(
    userScope: BranchScopedUser,
    productBaseId: string,
    dto: AddVariantWithStocksDto
  ) {
    // 1️⃣ Verificar que existe el ProductBase con relaciones
    const productBase = await this.productsBaseRepository.findOne({
      where: { id: productBaseId, isActive: true },
      relations: ['brand', 'category']
    });

    if (!productBase) {
      throw new NotFoundException('Product base not found or inactive');
    }

    const operationalBranchId = this.resolveOperationalBranchId(userScope);

    // 2️⃣ Generar SKU automático si no se proporciona
    const generatedSku =
      dto.sku ||
      this.generateSKU(productBase.name, productBase.brand?.name || 'GEN');
    const resolvedVariantName = dto.name?.trim() || productBase.name;

    // 3️⃣ Crear la variante
    const newVariant = this.variantsRepository.create({
      name: resolvedVariantName,
      price: dto.price,
      purchasePrice: dto.purchasePrice ?? 0,
      minStock: dto.minStock || 5,
      imgURL:
        'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
      sku: generatedSku,
      productBase: productBase,
      isActive: true
    });

    const savedVariant = await this.variantsRepository.save(newVariant);
    await this.ensureVariantAssignment(savedVariant, operationalBranchId);

    // 4️⃣ Crear múltiples StockLocation
    const stockLocations: StockLocation[] = [];

    for (const stockData of dto.stocks) {
      // Validar que si es branch, tenga branchId
      if (stockData.locationType === 'branch' && !stockData.branchId) {
        throw new BadRequestException(
          `Branch ID is required for branch location type`
        );
      }

      if (stockData.branchId) {
        await this.ensureVariantAssignment(savedVariant, stockData.branchId);
      }

      const savedStock = await this.stockService.createStockLocation({
        variantId: savedVariant.id,
        branchId: stockData.branchId,
        quantity: stockData.quantity,
        minStock: stockData.minStock || 5,
        locationType: stockData.locationType as StockLocationType,
        sku: generatedSku,
        costPrice: dto.purchasePrice ?? dto.price * 0.7,
        salePrice: dto.price
      });
      stockLocations.push(savedStock);
    }

    return {
      productBase,
      variant: savedVariant,
      stockLocations,
      message: `Variante creada exitosamente con ${stockLocations.length} ubicaciones de stock`
    };
  }

  async removeVariant(variantId: string) {
    // 1️⃣ Buscar la variante
    const variant = await this.variantsRepository.findOne({
      where: { id: variantId },
      relations: ['stockLocations']
    });

    if (!variant) {
      throw new NotFoundException(`Variante con ID ${variantId} no encontrada`);
    }

    // 2️⃣ Eliminar todos los stocks asociados
    if (variant.stockLocations && variant.stockLocations.length > 0) {
      for (const sl of variant.stockLocations) {
        await this.stockService.deleteStockLocation(sl.id);
      }
    }

    // 3️⃣ Eliminar la variante
    await this.variantsRepository.remove(variant);

    return {
      message: `Variante "${variant.name}" eliminada exitosamente`,
      variantId: variantId
    };
  }
}
