import {
  Injectable,
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
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);

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

  normalizeImportText(value?: string | null) {
    return value?.trim().replace(/\s+/g, ' ') || '';
  }

  private normalizeImportHeader(value?: string | null) {
    return this.normalizeImportText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  escapeCsvValue(value: unknown) {
    const serialized = String(value ?? '');
    if (
      serialized.includes(',') ||
      serialized.includes('"') ||
      serialized.includes('\n')
    ) {
      return `"${serialized.replace(/"/g, '""')}"`;
    }
    return serialized;
  }

  formatCsvDecimal(value: unknown) {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return '0.00';
    }
    return numericValue.toFixed(2);
  }

  formatCsvInteger(value: unknown) {
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

    if (['transito', 'transit', 'en_transito'].includes(normalizedValue)) {
      return 'transit';
    }

    return 'branch';
  }

  private parseExcelRows(fileBuffer: Buffer) {
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

    return rows.map((row) => ({
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
        this.getExcelValue(row, ['stock_minimo', 'minstock', 'stockminimo']) ?? 5
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
  }

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

  async previewImportFile(userScope: BranchScopedUser, fileBuffer: Buffer) {
    const normalizedRows = this.parseExcelRows(fileBuffer);
    return this.previewImport(userScope, { rows: normalizedRows });
  }

  async importProductsFile(userScope: BranchScopedUser, fileBuffer: Buffer) {
    const normalizedRows = this.parseExcelRows(fileBuffer);
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

            const categoryName = this.normalizeImportText(rawRow.categoryName).toUpperCase();
            const brandName = this.normalizeImportText(rawRow.brandName).toUpperCase();
            const productBaseName = this.normalizeImportText(rawRow.productBaseName);
            const variantName = this.normalizeImportText(rawRow.variantName) || productBaseName;
            const description = this.normalizeImportText(rawRow.description) || productBaseName;
            const sku = this.normalizeImportText(rawRow.sku);
            const branchName = this.normalizeImportText(rawRow.branchName);
            const purchasePrice = Number(rawRow.purchasePrice ?? 0);
            const salePrice = Number(rawRow.salePrice ?? 0);
            const minStock = Number(rawRow.minStock ?? 5);
            const stock = Number(rawRow.stock ?? 0);
            const locationType = this.resolveImportLocationType(rawRow.locationType);
            const locationName = this.normalizeImportText(rawRow.locationName) || branchName;

            let category: Category | null = categoryCache.get(categoryName) ?? null;
            if (!category) {
              category = await categoryRepo.findOne({ where: { name: categoryName } });
              if (!category) {
                category = categoryRepo.create({
                  name: categoryName,
                  description: this.normalizeImportText(
                    rawRow.groupName || rawRow.subgroupName || rawRow.description
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
                if (!brand.isActive) brand.isActive = true;
                brand = await brandRepo.save(brand);
              }
              brandCache.set(brandName, brand);
            }

            const productBaseKey = `${productBaseName}::${brand.id}::${category.id}`;
            let productBase: ProductsBase | null = productBaseCache.get(productBaseKey) ?? null;
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
                productBase.description = description || productBase.description;
                productBase.brand = brand;
                productBase.category = category;
                if (!productBase.isActive) productBase.isActive = true;
                productBase = await productBaseRepo.save(productBase);
              }

              productBaseCache.set(productBaseKey, productBase);
            }

            let variant: ProductVariant | null = null;
            if (sku) {
              variant = await variantRepo.findOne({
                where: { sku },
                relations: ['productBase', 'stockLocations', 'stockLocations.branch']
              });
            }

            if (!variant) {
              variant = await variantRepo.findOne({
                where: { name: variantName, productBase: { id: productBase.id } },
                relations: ['productBase', 'stockLocations', 'stockLocations.branch']
              });
            }

            if (!variant) {
              const generatedSku = sku || this.generateSKU(productBase.name, brand.name || 'GEN');
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
              if (!variant.isActive) variant.isActive = true;
              variant = await variantRepo.save(variant);
              updatedVariants += 1;
            }

            const existingAssignment = await variantBranchRepo.findOne({
              where: { variantId: variant.id, branchId: activeBranch.id }
            });
            if (!existingAssignment) {
              await variantBranchRepo.save(
                variantBranchRepo.create({
                  variantId: variant.id,
                  branchId: activeBranch.id,
                  isActive: true,
                  variant,
                  branch: activeBranch
                })
              );
            } else if (!existingAssignment.isActive) {
              existingAssignment.isActive = true;
              await variantBranchRepo.save(existingAssignment);
            }

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
                if (!stockLocation.isActive) stockLocation.isActive = true;
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

      return { message: 'Importación completada correctamente', summary: result };
    } catch (error: any) {
      const detailParts = [
        error?.message,
        error?.detail,
        error?.driverError?.detail,
        error?.driverError?.message
      ].filter(
        (value, index, array) => Boolean(value) && array.indexOf(value) === index
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

    const [categories, brands, productBases, variantsBySku] = await Promise.all([
      categoryNames.length
        ? this.categoriesRepository.find({ where: { name: In(categoryNames), isActive: true } })
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
    ]);

    const categoryMap = new Map(
      categories.map((c) => [this.normalizeImportText(c.name), c])
    );
    const brandMap = new Map(
      brands.map((b) => [this.normalizeImportText(b.name), b])
    );
    const productBaseMap = new Map(
      productBases.map((pb) => [
        `${this.normalizeImportText(pb.name)}::${this.normalizeImportText(pb.brand?.name)}::${this.normalizeImportText(pb.category?.name)}`,
        pb
      ])
    );
    const variantSkuMap = new Map(
      variantsBySku.map((v) => [this.normalizeImportText(v.sku), v])
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
      { productBaseName: string; brandName: string; categoryName: string; variantName: string; sku: string }
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
        rowErrors.push('El precio de venta debe ser numérico y mayor o igual a 0');
      if (!Number.isFinite(row.purchasePrice) || row.purchasePrice < 0)
        rowErrors.push('El precio de compra debe ser numérico y mayor o igual a 0');
      if (!Number.isFinite(row.stock) || row.stock < 0)
        rowErrors.push('El stock debe ser numérico y mayor o igual a 0');
      if (!row.locationName && row.stock > 0)
        rowErrors.push('La ubicación es obligatoria cuando se informa stock');

      const existingCategory = categoryMap.get(row.categoryName);
      const existingBrand = brandMap.get(row.brandName);
      const productBaseKey = `${row.productBaseName}::${row.brandName}::${row.categoryName}`;
      const existingProductBase = productBaseMap.get(productBaseKey);
      const existingVariantBySku = row.sku ? variantSkuMap.get(row.sku) : undefined;

      if (!existingCategory) toCreateCategoryNames.add(row.categoryName);

      if (!existingBrand) {
        toCreateBrandNames.add(row.brandName);
      } else if (existingCategory) {
        const brandHasCategory = existingBrand.categories?.some(
          (c) => this.normalizeImportText(c.name) === row.categoryName
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
          productBaseName: existingVariantBySku.productBase?.name || row.productBaseName,
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
}
