import { CreateProductBaseSimpleDto } from './dto/create-product-base-simple.dto';
import { UpdateProductsBaseDto } from './dto/update-products-base.dto';
import { AddVariantWithStocksDto } from './dto/add-variant-with-stocks.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as XLSX from 'xlsx';
import { ProductsBase } from './entities/products-base.entity';
import { Brand } from 'src/brands/entities/brand.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { ProductVariantBranch } from 'src/products-variants/entities/product-variant-branch.entity';
import { StockLocation } from 'src/branches/entities/stock-location.entity';
import { StockLocationType } from 'src/branches/entities/stock-location.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { Category } from 'src/categories/entities/category.entity';
import { PreviewProductsImportDto } from './dto/preview-products-import.dto';
import { resolveBranchScope, type BranchScopedUser } from 'src/common/auth/branch-scope.util';
import { StockService } from 'src/stock/stock.service';

@Injectable()
export class ProductsBaseService {
  private readonly logger = new Logger(ProductsBaseService.name);

  constructor(
    @InjectRepository(ProductsBase)
    private readonly productsBaseRepository: Repository<ProductsBase>,

    @InjectRepository(Brand)
    private readonly brandsRepository: Repository<Brand>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,

    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,

    @InjectRepository(ProductVariantBranch)
    private readonly variantBranchRepository: Repository<ProductVariantBranch>,

    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,

    @Inject(forwardRef(() => StockService))
    private readonly stockService: StockService
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
    branch?: Branch | null,
    repo: Repository<ProductVariantBranch> = this.variantBranchRepository
  ) {
    const resolvedBranch = branch
      ?? (await this.branchesRepository.findOne({
        where: { id: branchId, isActive: true }
      }));

    if (!resolvedBranch) {
      throw new BadRequestException('La sucursal activa no existe o está inactiva');
    }

    const existingAssignment = await repo.findOne({
      where: {
        variantId: variant.id,
        branchId: resolvedBranch.id
      }
    });

    if (existingAssignment) {
      if (!existingAssignment.isActive) {
        existingAssignment.isActive = true;
        await repo.save(existingAssignment);
      }
      return existingAssignment;
    }

    const createdAssignment = repo.create({
      variantId: variant.id,
      branchId: resolvedBranch.id,
      isActive: true,
      variant,
      branch: resolvedBranch
    });

    return repo.save(createdAssignment);
  }

  private normalizeImportText(value?: string | null) {
    return value?.trim().replace(/\s+/g, ' ') || '';
  }

  private normalizeImportHeader(value?: string | null) {
    return this.normalizeImportText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private escapeCsvValue(value: unknown) {
    const serialized = String(value ?? '');
    if (
      serialized.includes(',') ||
      serialized.includes('"') ||
      serialized.includes('\n') ||
      serialized.includes('\r')
    ) {
      return `"${serialized.replace(/"/g, '""')}"`;
    }

    return serialized;
  }

  private formatCsvDecimal(value: unknown) {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return '0.00';
    }

    return numericValue.toFixed(2);
  }

  private formatCsvInteger(value: unknown) {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return '0';
    }

    return String(Math.trunc(numericValue));
  }

  private getExcelValue(row: Record<string, unknown>, aliases: string[]) {
    const normalizedEntries = Object.entries(row).map(
      ([key, value]) => [this.normalizeImportHeader(key), value] as const
    );

    for (const alias of aliases) {
      const normalizedAlias = this.normalizeImportHeader(alias);
      const match = normalizedEntries.find(([key]) => key === normalizedAlias);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  private resolveImportLocationType(
    rawValue?: string | null
  ): 'branch' | 'warehouse' | 'transit' {
    const normalizedValue = this.normalizeImportHeader(rawValue);

    if (['deposito', 'warehouse', 'almacen'].includes(normalizedValue)) {
      return 'warehouse';
    }

    if (['transito', 'transit', 'entransito'].includes(normalizedValue)) {
      return 'transit';
    }

    return 'branch';
  }

  async previewImportFile(userScope: BranchScopedUser, fileBuffer: Buffer) {
    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false
    });

    if (rows.length === 0) {
      throw new BadRequestException(
        'La hoja seleccionada no contiene filas para importar'
      );
    }

    const normalizedRows = rows.map((row) => ({
      categoryName: String(
        this.getExcelValue(row, ['categoria', 'category', 'rubro']) ?? ''
      ),
      brandName: String(this.getExcelValue(row, ['marca', 'brand']) ?? ''),
      productBaseName: String(
        this.getExcelValue(row, [
          'producto_base',
          'productbase',
          'producto',
          'nombre_producto'
        ]) ?? ''
      ),
      variantName: String(
        this.getExcelValue(row, [
          'variante',
          'productvariant',
          'variant',
          'detalle',
          'presentacion'
        ]) ?? ''
      ),
      sku: String(
        this.getExcelValue(row, ['sku', 'codigo', 'codigo_barras']) ?? ''
      ),
      description: String(
        this.getExcelValue(row, ['descripcion', 'description']) ?? ''
      ),
      purchasePrice: Number(
        this.getExcelValue(row, [
          'precio_compra',
          'purchaseprice',
          'costo',
          'costoprecio'
        ]) ?? 0
      ),
      salePrice: Number(
        this.getExcelValue(row, [
          'precio_venta',
          'saleprice',
          'precio',
          'pvp'
        ]) ?? 0
      ),
      minStock: Number(
        this.getExcelValue(row, ['stock_minimo', 'minstock', 'stockminimo']) ??
          5
      ),
      branchName: String(
        this.getExcelValue(row, ['sucursal', 'branch', 'deposito']) ?? ''
      ),
      locationType: this.resolveImportLocationType(
        String(
          this.getExcelValue(row, [
            'tipo_ubicacion',
            'location_type',
            'tipoubicacion',
            'ubicacion_tipo'
          ]) ?? 'branch'
        )
      ),
      locationName: String(
        this.getExcelValue(row, [
          'ubicacion',
          'location',
          'location_name',
          'nombre_ubicacion',
          'deposito',
          'sucursal',
          'branch'
        ]) ?? ''
      ),
      stock: Number(
        this.getExcelValue(row, ['stock', 'cantidad', 'cantidad_stock']) ?? 0
      ),
      groupName: String(this.getExcelValue(row, ['grupo', 'group']) ?? ''),
      subgroupName: String(
        this.getExcelValue(row, ['subgrupo', 'subgroup']) ?? ''
      )
    }));

    return this.previewImport(userScope, { rows: normalizedRows });
  }

  async importProductsFile(userScope: BranchScopedUser, fileBuffer: Buffer) {
    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false
    });

    if (rows.length === 0) {
      throw new BadRequestException(
        'La hoja seleccionada no contiene filas para importar'
      );
    }

    const normalizedRows = rows.map((row) => ({
      categoryName: String(
        this.getExcelValue(row, ['categoria', 'category', 'rubro']) ?? ''
      ),
      brandName: String(this.getExcelValue(row, ['marca', 'brand']) ?? ''),
      productBaseName: String(
        this.getExcelValue(row, [
          'producto_base',
          'productbase',
          'producto',
          'nombre_producto'
        ]) ?? ''
      ),
      variantName: String(
        this.getExcelValue(row, [
          'variante',
          'productvariant',
          'variant',
          'detalle',
          'presentacion'
        ]) ?? ''
      ),
      sku: String(
        this.getExcelValue(row, ['sku', 'codigo', 'codigo_barras']) ?? ''
      ),
      description: String(
        this.getExcelValue(row, ['descripcion', 'description']) ?? ''
      ),
      purchasePrice: Number(
        this.getExcelValue(row, [
          'precio_compra',
          'purchaseprice',
          'costo',
          'costoprecio'
        ]) ?? 0
      ),
      salePrice: Number(
        this.getExcelValue(row, [
          'precio_venta',
          'saleprice',
          'precio',
          'pvp'
        ]) ?? 0
      ),
      minStock: Number(
        this.getExcelValue(row, ['stock_minimo', 'minstock', 'stockminimo']) ??
          5
      ),
      branchName: String(
        this.getExcelValue(row, ['sucursal', 'branch', 'deposito']) ?? ''
      ),
      locationType: this.resolveImportLocationType(
        String(
          this.getExcelValue(row, [
            'tipo_ubicacion',
            'location_type',
            'tipoubicacion',
            'ubicacion_tipo'
          ]) ?? 'branch'
        )
      ),
      locationName: String(
        this.getExcelValue(row, [
          'ubicacion',
          'location',
          'location_name',
          'nombre_ubicacion',
          'deposito',
          'sucursal',
          'branch'
        ]) ?? ''
      ),
      stock: Number(
        this.getExcelValue(row, ['stock', 'cantidad', 'cantidad_stock']) ?? 0
      ),
      groupName: String(this.getExcelValue(row, ['grupo', 'group']) ?? ''),
      subgroupName: String(
        this.getExcelValue(row, ['subgrupo', 'subgroup']) ?? ''
      )
    }));

    return this.importProducts(userScope, { rows: normalizedRows });
  }

  async importProducts(userScope: BranchScopedUser, dto: PreviewProductsImportDto) {
    const operationalBranchId = this.resolveOperationalBranchId(userScope);
    const preview = await this.previewImport(userScope, dto);

    if (preview.errors.length > 0) {
      throw new BadRequestException({
        message:
          'La importación contiene errores. Revise el preview antes de confirmar.',
        errors: preview.errors
      });
    }

    let lastProcessedRow = 0;

    try {
      const result = await this.productsBaseRepository.manager.transaction(
        async (manager) => {
          const categoryRepo = manager.getRepository(Category);
          const brandRepo = manager.getRepository(Brand);
          const productBaseRepo = manager.getRepository(ProductsBase);
          const variantRepo = manager.getRepository(ProductVariant);
          const variantBranchRepo = manager.getRepository(ProductVariantBranch);
          const stockLocationRepo = manager.getRepository(StockLocation);
          const branchRepo = manager.getRepository(Branch);

          const categoryCache = new Map<string, Category>();
          const brandCache = new Map<string, Brand>();
          const productBaseCache = new Map<string, ProductsBase>();
          const branchCache = new Map<string, Branch>();
          const activeBranch = await branchRepo.findOne({
            where: { id: operationalBranchId, isActive: true }
          });

          if (!activeBranch) {
            throw new BadRequestException(
              'La sucursal activa no existe o está inactiva para importar productos'
            );
          }

          let createdCategories = 0;
          let createdBrands = 0;
          let createdProductBases = 0;
          let createdVariants = 0;
          let updatedVariants = 0;
          let createdStockLocations = 0;
          let updatedStockLocations = 0;

          for (const [index, rawRow] of dto.rows.entries()) {
            lastProcessedRow = index + 1;

            const categoryName = this.normalizeImportText(
              rawRow.categoryName
            ).toUpperCase();
            const brandName = this.normalizeImportText(
              rawRow.brandName
            ).toUpperCase();
            const productBaseName = this.normalizeImportText(
              rawRow.productBaseName
            );
            const variantName =
              this.normalizeImportText(rawRow.variantName) || productBaseName;
            const description =
              this.normalizeImportText(rawRow.description) || productBaseName;
            const sku = this.normalizeImportText(rawRow.sku);
            const branchName = this.normalizeImportText(rawRow.branchName);
            const purchasePrice = Number(rawRow.purchasePrice ?? 0);
            const salePrice = Number(rawRow.salePrice ?? 0);
            const minStock = Number(rawRow.minStock ?? 5);
            const stock = Number(rawRow.stock ?? 0);
            const locationType = this.resolveImportLocationType(
              rawRow.locationType
            );
            const locationName =
              this.normalizeImportText(rawRow.locationName) || branchName;

            let category: Category | null =
              categoryCache.get(categoryName) ?? null;
            if (!category) {
              category = await categoryRepo.findOne({
                where: { name: categoryName }
              });
              if (!category) {
                category = categoryRepo.create({
                  name: categoryName,
                  description: this.normalizeImportText(
                    rawRow.groupName ||
                      rawRow.subgroupName ||
                      rawRow.description
                  ),
                  isActive: true
                });
                category = await categoryRepo.save(category);
                createdCategories += 1;
              } else if (!category.isActive) {
                category.isActive = true;
                category = await categoryRepo.save(category);
              }
              categoryCache.set(categoryName, category);
            }

            let brand: Brand | null = brandCache.get(brandName) ?? null;
            if (!brand) {
              brand = await brandRepo.findOne({
                where: { name: brandName },
                relations: ['categories']
              });
              if (!brand) {
                brand = brandRepo.create({
                  name: brandName,
                  description: this.normalizeImportText(rawRow.description),
                  categories: [category],
                  isActive: true
                });
                brand = await brandRepo.save(brand);
                createdBrands += 1;
              } else {
                const categories = brand.categories || [];
                if (!categories.some((item) => item.id === category.id)) {
                  brand.categories = [...categories, category];
                }
                if (!brand.isActive) {
                  brand.isActive = true;
                }
                brand = await brandRepo.save(brand);
              }
              brandCache.set(brandName, brand);
            }

            const productBaseKey = `${productBaseName}::${brand.id}::${category.id}`;
            let productBase: ProductsBase | null =
              productBaseCache.get(productBaseKey) ?? null;
            if (!productBase) {
              productBase = await productBaseRepo.findOne({
                where: {
                  name: productBaseName,
                  brand: { id: brand.id },
                  category: { id: category.id }
                },
                relations: ['brand', 'category']
              });

              if (!productBase) {
                productBase = productBaseRepo.create({
                  name: productBaseName,
                  description,
                  brand,
                  category,
                  isActive: true
                });
                productBase = await productBaseRepo.save(productBase);
                createdProductBases += 1;
              } else {
                productBase.description =
                  description || productBase.description;
                productBase.brand = brand;
                productBase.category = category;
                if (!productBase.isActive) {
                  productBase.isActive = true;
                }
                productBase = await productBaseRepo.save(productBase);
              }

              productBaseCache.set(productBaseKey, productBase);
            }

            let variant: ProductVariant | null = null;
            if (sku) {
              variant = await variantRepo.findOne({
                where: { sku },
                relations: [
                  'productBase',
                  'stockLocations',
                  'stockLocations.branch'
                ]
              });
            }

            if (!variant) {
              variant = await variantRepo.findOne({
                where: {
                  name: variantName,
                  productBase: { id: productBase.id }
                },
                relations: [
                  'productBase',
                  'stockLocations',
                  'stockLocations.branch'
                ]
              });
            }

            if (!variant) {
              const generatedSku =
                sku || this.generateSKU(productBase.name, brand.name || 'GEN');
              variant = variantRepo.create({
                name: variantName,
                sku: generatedSku,
                price: salePrice,
                purchasePrice,
                minStock,
                imgURL:
                  'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
                productBase,
                isActive: true
              });
              variant = await variantRepo.save(variant);
              createdVariants += 1;
            } else {
              variant.name = variantName;
              variant.sku = sku || variant.sku;
              variant.price = salePrice;
              variant.purchasePrice = purchasePrice;
              variant.minStock = minStock;
              variant.productBase = productBase;
              if (!variant.isActive) {
                variant.isActive = true;
              }
              variant = await variantRepo.save(variant);
              updatedVariants += 1;
            }

            await this.ensureVariantAssignment(
              variant,
              activeBranch.id,
              activeBranch,
              variantBranchRepo
            );

            if (locationName) {
              let branch: Branch | null = branchCache.get(locationName) ?? null;
              if (!branch) {
                branch = await branchRepo.findOne({
                  where: { name: locationName, isActive: true }
                });
                if (!branch) {
                  throw new BadRequestException(
                    `La ubicación ${locationName} no existe o está inactiva`
                  );
                }
                branchCache.set(locationName, branch);
              }

              let stockLocation = await stockLocationRepo.findOne({
                where: {
                  branch: { id: branch.id },
                  productVariant: { id: variant.id },
                  locationType: locationType as StockLocationType
                },
                relations: ['branch', 'productVariant']
              });

              if (!stockLocation) {
                stockLocation = stockLocationRepo.create({
                  sku: variant.sku,
                  quantity: stock,
                  reservedQuantity: 0,
                  availableQuantity: stock,
                  minStock,
                  locationType: locationType as StockLocationType,
                  costPrice: purchasePrice,
                  salePrice,
                  isActive: true,
                  branch,
                  productVariant: variant
                });
                await stockLocationRepo.save(stockLocation);
                createdStockLocations += 1;
              } else {
                stockLocation.sku = variant.sku;
                stockLocation.quantity = stock;
                stockLocation.availableQuantity = Math.max(
                  0,
                  stock - (stockLocation.reservedQuantity || 0)
                );
                stockLocation.minStock = minStock;
                stockLocation.costPrice = purchasePrice;
                stockLocation.salePrice = salePrice;
                stockLocation.locationType = locationType as StockLocationType;
                if (!stockLocation.isActive) {
                  stockLocation.isActive = true;
                }
                await stockLocationRepo.save(stockLocation);
                updatedStockLocations += 1;
              }
            }
          }

          return {
            createdCategories,
            createdBrands,
            createdProductBases,
            createdVariants,
            updatedVariants,
            createdStockLocations,
            updatedStockLocations
          };
        }
      );

      return {
        message: 'Importación completada correctamente',
        summary: result
      };
    } catch (error: any) {
      const detailParts = [
        error?.message,
        error?.detail,
        error?.driverError?.detail,
        error?.driverError?.message
      ].filter(
        (value, index, array) =>
          Boolean(value) && array.indexOf(value) === index
      );
      const detail = detailParts.join(' | ');

      this.logger.error(
        `Error en importación masiva de productos en fila ${lastProcessedRow || 'desconocida'}: ${detail || 'sin detalle'}`,
        error?.stack
      );

      throw new BadRequestException({
        message: `Falló la importación en la fila ${lastProcessedRow || 'desconocida'}${detail ? `: ${detail}` : ''}`,
        error: 'PRODUCTS_IMPORT_FAILED',
        rowNumber: lastProcessedRow || null,
        detail: detail || null
      });
    }
  }

  async previewImport(userScope: BranchScopedUser, dto: PreviewProductsImportDto) {
    const operationalBranchId = this.resolveOperationalBranchId(userScope);
    const activeBranch = await this.branchesRepository.findOne({
      where: { id: operationalBranchId, isActive: true }
    });

    if (!activeBranch) {
      throw new BadRequestException(
        'La sucursal activa no existe o está inactiva para importar productos'
      );
    }

    const normalizedRows = dto.rows.map((row, index) => ({
      rowNumber: index + 1,
      categoryName: this.normalizeImportText(row.categoryName),
      brandName: this.normalizeImportText(row.brandName),
      productBaseName: this.normalizeImportText(row.productBaseName),
      variantName:
        this.normalizeImportText(row.variantName) ||
        this.normalizeImportText(row.productBaseName),
      sku: this.normalizeImportText(row.sku),
      description: this.normalizeImportText(row.description),
      purchasePrice: Number(row.purchasePrice ?? 0),
      salePrice: Number(row.salePrice ?? 0),
      minStock: Number(row.minStock ?? 5),
      branchName: this.normalizeImportText(row.branchName),
      locationType: this.resolveImportLocationType(row.locationType),
      locationName:
        this.normalizeImportText(row.locationName) ||
        this.normalizeImportText(row.branchName),
      stock: Number(row.stock ?? 0),
      groupName: this.normalizeImportText(row.groupName),
      subgroupName: this.normalizeImportText(row.subgroupName)
    }));

    const categoryNames = Array.from(
      new Set(normalizedRows.map((row) => row.categoryName).filter(Boolean))
    );
    const brandNames = Array.from(
      new Set(normalizedRows.map((row) => row.brandName).filter(Boolean))
    );
    const productBaseNames = Array.from(
      new Set(normalizedRows.map((row) => row.productBaseName).filter(Boolean))
    );
    const variantSkus = Array.from(
      new Set(normalizedRows.map((row) => row.sku).filter(Boolean))
    );

    const [categories, brands, productBases, variantsBySku] = await Promise.all(
      [
        categoryNames.length
          ? this.categoriesRepository.find({
              where: { name: In(categoryNames), isActive: true }
            })
          : Promise.resolve([]),
        brandNames.length
          ? this.brandsRepository.find({
              where: { name: In(brandNames), isActive: true },
              relations: ['categories']
            })
          : Promise.resolve([]),
        productBaseNames.length
          ? this.productsBaseRepository.find({
              where: { name: In(productBaseNames), isActive: true },
              relations: ['brand', 'category', 'variants']
            })
          : Promise.resolve([]),
        variantSkus.length
          ? this.variantsRepository.find({
              where: { sku: In(variantSkus), isActive: true },
              relations: ['productBase']
            })
          : Promise.resolve([])
      ]
    );

    const categoryMap = new Map(
      categories.map((category) => [
        this.normalizeImportText(category.name),
        category
      ])
    );
    const brandMap = new Map(
      brands.map((brand) => [this.normalizeImportText(brand.name), brand])
    );
    const productBaseMap = new Map(
      productBases.map((productBase) => [
        `${this.normalizeImportText(productBase.name)}::${this.normalizeImportText(productBase.brand?.name)}::${this.normalizeImportText(productBase.category?.name)}`,
        productBase
      ])
    );
    const variantSkuMap = new Map(
      variantsBySku.map((variant) => [
        this.normalizeImportText(variant.sku),
        variant
      ])
    );

    const errors: Array<{ rowNumber: number; messages: string[] }> = [];
    const toCreateCategoryNames = new Set<string>();
    const toCreateBrandNames = new Set<string>();
    const toCreateProductBaseMap = new Map<
      string,
      { productBaseName: string; brandName: string; categoryName: string }
    >();
    const toCreateVariantMap = new Map<
      string,
      {
        productBaseName: string;
        brandName: string;
        categoryName: string;
        variantName: string;
        sku: string;
      }
    >();
    const toUpdate = {
      variants: [] as Array<{
        rowNumber: number;
        sku: string;
        productBaseName: string;
        variantName: string;
        currentPrice: number;
        nextPrice: number;
      }>
    };
    const validRows: Array<{
      rowNumber: number;
      categoryName: string;
      brandName: string;
      productBaseName: string;
      variantName: string;
      sku: string;
      salePrice: number;
      purchasePrice: number;
      assignedBranchName: string;
    }> = [];

    for (const row of normalizedRows) {
      const rowErrors: string[] = [];

      if (!row.categoryName) rowErrors.push('La categoría es obligatoria');
      if (!row.brandName) rowErrors.push('La marca es obligatoria');
      if (!row.productBaseName) rowErrors.push('El productBase es obligatorio');
      if (!row.variantName) rowErrors.push('La variante es obligatoria');
      if (!Number.isFinite(row.salePrice) || row.salePrice < 0)
        rowErrors.push(
          'El precio de venta debe ser numérico y mayor o igual a 0'
        );
      if (!Number.isFinite(row.purchasePrice) || row.purchasePrice < 0)
        rowErrors.push(
          'El precio de compra debe ser numérico y mayor o igual a 0'
        );
      if (!Number.isFinite(row.stock) || row.stock < 0)
        rowErrors.push('El stock debe ser numérico y mayor o igual a 0');
      if (!row.locationName && row.stock > 0)
        rowErrors.push('La ubicación es obligatoria cuando se informa stock');

      const existingCategory = categoryMap.get(row.categoryName);
      const existingBrand = brandMap.get(row.brandName);
      const productBaseKey = `${row.productBaseName}::${row.brandName}::${row.categoryName}`;
      const existingProductBase = productBaseMap.get(productBaseKey);
      const existingVariantBySku = row.sku
        ? variantSkuMap.get(row.sku)
        : undefined;

      if (!existingCategory) {
        toCreateCategoryNames.add(row.categoryName);
      }

      if (!existingBrand) {
        toCreateBrandNames.add(row.brandName);
      } else if (existingCategory) {
        const brandHasCategory = existingBrand.categories?.some(
          (category) =>
            this.normalizeImportText(category.name) === row.categoryName
        );

        if (!brandHasCategory) {
          rowErrors.push(
            `La marca ${row.brandName} existe pero no está asociada a la categoría ${row.categoryName}`
          );
        }
      }

      if (!existingProductBase) {
        toCreateProductBaseMap.set(productBaseKey, {
          productBaseName: row.productBaseName,
          brandName: row.brandName,
          categoryName: row.categoryName
        });
      }

      if (existingVariantBySku) {
        toUpdate.variants.push({
          rowNumber: row.rowNumber,
          sku: existingVariantBySku.sku,
          productBaseName:
            existingVariantBySku.productBase?.name || row.productBaseName,
          variantName: existingVariantBySku.name,
          currentPrice: Number(existingVariantBySku.price ?? 0),
          nextPrice: row.salePrice
        });
      } else {
        toCreateVariantMap.set(
          `${productBaseKey}::${row.variantName}::${row.sku || 'NO_SKU'}`,
          {
            productBaseName: row.productBaseName,
            brandName: row.brandName,
            categoryName: row.categoryName,
            variantName: row.variantName,
            sku: row.sku
          }
        );
      }

      if (rowErrors.length > 0) {
        errors.push({ rowNumber: row.rowNumber, messages: rowErrors });
        continue;
      }

      validRows.push({
        rowNumber: row.rowNumber,
        categoryName: row.categoryName,
        brandName: row.brandName,
        productBaseName: row.productBaseName,
        variantName: row.variantName,
        sku: row.sku,
        salePrice: row.salePrice,
        purchasePrice: row.purchasePrice,
        assignedBranchName: activeBranch.name
      });
    }

    return {
      summary: {
        totalRows: normalizedRows.length,
        validRows: validRows.length,
        errorRows: errors.length,
        createCategories: toCreateCategoryNames.size,
        createBrands: toCreateBrandNames.size,
        createProductBases: toCreateProductBaseMap.size,
        createVariants: toCreateVariantMap.size,
        updateVariants: toUpdate.variants.length,
        assignedBranchId: activeBranch.id,
        assignedBranchName: activeBranch.name
      },
      toCreate: {
        categories: Array.from(toCreateCategoryNames),
        brands: Array.from(toCreateBrandNames),
        productBases: Array.from(toCreateProductBaseMap.values()),
        variants: Array.from(toCreateVariantMap.values())
      },
      toUpdate,
      errors,
      validRows
    };
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
  async checkLowStock(variantId: string): Promise<{
    // 🏪 Stock por sucursal/deposito
    locationStocks: Array<{
      branchName: string;
      locationType: 'branch' | 'warehouse';
      quantity: number;
      minStock: number;
      isLow: boolean;
      alertMessage?: string;
    }>;

    // 📊 Stock total (sin tránsito)
    totalStock: {
      quantity: number;
      minStock: number;
      isLow: boolean;
      alertMessage?: string;
    };

    // 🚚 Stock en tránsito (solo informativo)
    transitStock: {
      quantity: number;
      infoMessage: string;
    };

    // 🚨 Alertas generadas
    alerts: string[];
  }> {
    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, isActive: true },
      relations: ['stockLocations', 'stockLocations.branch']
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const stockLocations = variant.stockLocations.filter((sl) => sl.isActive);
    const alerts: string[] = [];

    // 🏪 Separar stocks por tipo
    const locationStocks = stockLocations
      .filter(
        (sl) =>
          sl.locationType === StockLocationType.BRANCH ||
          sl.locationType === StockLocationType.WAREHOUSE
      )
      .map((sl) => {
        const isLow = sl.availableQuantity <= (sl.minStock || variant.minStock);
        const alertMessage = isLow
          ? `⚠️ Stock bajo en ${sl.branch?.name || 'Depósito'}: ${sl.availableQuantity}/${sl.minStock || variant.minStock}`
          : undefined;

        if (isLow) alerts.push(alertMessage!);

        return {
          branchName: sl.branch?.name || 'Depósito',
          locationType: sl.locationType as 'branch' | 'warehouse',
          quantity: sl.availableQuantity,
          minStock: sl.minStock || variant.minStock,
          isLow,
          alertMessage
        };
      });

    // 📊 Calcular stock total (sin tránsito)
    const totalQuantity = locationStocks.reduce(
      (total, ls) => total + ls.quantity,
      0
    );
    const isTotalLow = totalQuantity <= variant.minStock;
    const totalAlertMessage = isTotalLow
      ? `🚨 Stock total bajo: ${totalQuantity}/${variant.minStock} unidades`
      : undefined;

    if (isTotalLow) alerts.push(totalAlertMessage!);

    // 🚚 Stock en tránsito (solo informativo)
    const transitQuantity = stockLocations
      .filter((sl) => sl.locationType === StockLocationType.TRANSIT)
      .reduce((total, sl) => total + sl.availableQuantity, 0);

    const transitInfoMessage =
      transitQuantity > 0
        ? `🚚 Tienes ${transitQuantity} unidades en tránsito`
        : '🚚 No hay unidades en tránsito';

    return {
      locationStocks,
      totalStock: {
        quantity: totalQuantity,
        minStock: variant.minStock,
        isLow: isTotalLow,
        alertMessage: totalAlertMessage
      },
      transitStock: {
        quantity: transitQuantity,
        infoMessage: transitInfoMessage
      },
      alerts
    };
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
