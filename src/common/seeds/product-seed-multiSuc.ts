import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Branch } from 'src/branches/entities/branch.entity';
import { Category } from 'src/categories/entities/category.entity';
import { Brand } from 'src/brands/entities/brand.entity';
import { ProductsBase } from 'src/products-base/entities/products-base.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { ProductVariantBranch } from 'src/products-variants/entities/product-variant-branch.entity';

@Injectable()
export class ProductSeedService implements OnModuleInit {
  private readonly logger = new Logger(ProductSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  // Helper para pausar la ejecución de forma asíncrona
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleInit() {
    this.logger.log('⏳ Inicializando chequeo de dependencias para Seeding de Productos...');
    
    // Ejecutamos en segundo plano para no bloquear el inicio del servidor NestJS
    this.runSeedWithRetry();
  }

  private async runSeedWithRetry() {
    const branchRepo = this.dataSource.getRepository(Branch);
    let sucursalCentral: Branch | null = null;
    let sucursalNorte: Branch | null = null;
    
    const maxRetries = 10;
    let attempts = 0;

    // Bucle de espera (Polling) hasta que el BranchSeeder inserte las sucursales
    while (attempts < maxRetries) {
      sucursalCentral = await branchRepo.findOne({ where: { name: 'Sucursal Central' } });
      sucursalNorte = await branchRepo.findOne({ where: { name: 'Sucursal Norte' } });

      if (sucursalCentral && sucursalNorte) {
        this.logger.log('✨ ¡Sucursales detectadas! Procediendo a cargar los productos...');
        break;
      }

      attempts++;
      this.logger.warn(
        `⚠️ Esperando que las sucursales se inicialicen... (Intento ${attempts}/${maxRetries})`
      );
      await this.sleep(1500); // Espera 1.5 segundos antes de volver a verificar
    }

    if (!sucursalCentral || !sucursalNorte) {
      this.logger.error(
        '❌ Cancelando Seeding de productos: Superó el tiempo de espera y las sucursales no fueron creadas.'
      );
      return;
    }

    // Una vez confirmadas las sucursales, arranca la transacción y la carga pesada
    await this.executeSeeding(sucursalCentral, sucursalNorte);
  }

  private async executeSeeding(sucursalCentral: Branch, sucursalNorte: Branch) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Cargar 150 Artículos del Hogar en -> SUCURSAL CENTRAL
      this.logger.log('📺 Generando 150 productos de Hogar para "Sucursal Central"...');
      await this.seedBusinessLine({
        manager: queryRunner.manager,
        branch: sucursalCentral,
        prefix: 'HOG',
        startSku: 2000,
        categoriesData: [
          { name: 'ELECTRODOMESTICOS', bases: ['LAVARROPAS', 'HELADERAS', 'MICROONDAS'] },
          { name: 'CLIMATIZACION', bases: ['SPLIT FRIO/CALOR', 'ESTUFAS ELECTRICAS'] },
          { name: 'TECNOLOGIA Y TV', bases: ['SMART TV LED', 'PARLANTES BT'] }
        ],
        brands: ['SAMSUNG', 'PHILIPS', 'PEABODY', 'BGH'],
        variantsTemplates: [
          { name: 'PREMIUM EDITION', priceMultiplier: 1.4, cost: 120000 },
          { name: 'ECONOMIC BASE', priceMultiplier: 1.15, cost: 45000 },
          { name: 'SMART PLUS', priceMultiplier: 1.25, cost: 85000 }
        ]
      });

      // 2. Cargar 150 Artículos de Ferretería en -> SUCURSAL NORTE
      this.logger.log('🔧 Generando 150 productos de Ferretería para "Sucursal Norte"...');
      await this.seedBusinessLine({
        manager: queryRunner.manager,
        branch: sucursalNorte,
        prefix: 'FER',
        startSku: 1000,
        categoriesData: [
          { name: 'HERRAMIENTAS MANUALES', bases: ['DESTORNILLADORES', 'MARTILLOS', 'LLAVES ACOPLADAS'] },
          { name: 'HERRAMIENTAS ELECTRICAS', bases: ['TALADROS PERCUTORES', 'AMOLADORAS ANGULARES'] },
          { name: 'FIJACIONES Y BULONERIA', bases: ['TORNILLOS MADERA', 'TARUGOS EXPANSIVOS'] }
        ],
        brands: ['STANLEY', 'DEWALT', 'BOSCH', 'BREMEN'],
        variantsTemplates: [
          { name: 'PROFESIONAL STANDARD', priceMultiplier: 1.25, cost: 2500 },
          { name: 'INDUSTRIAL REFORZADO', priceMultiplier: 1.45, cost: 8500 },
          { name: 'HOGAREÑO ECONOMICO', priceMultiplier: 1.15, cost: 1200 }
        ]
      });

      await queryRunner.commitTransaction();
      this.logger.log('✅ Seeding de productos finalizado con éxito.');
    } catch (error) {
      this.logger.error('❌ Error durante el seeding de productos, revirtiendo cambios...', error.stack);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  private async seedBusinessLine(config: {
    manager: any;
    branch: Branch;
    prefix: string;
    startSku: number;
    categoriesData: Array<{ name: string; bases: string[] }>;
    brands: string[];
    variantsTemplates: Array<{ name: string; priceMultiplier: number; cost: number }>;
  }) {
    const { manager, branch, prefix, startSku, categoriesData, brands, variantsTemplates } = config;

    const categoryRepo = manager.getRepository(Category);
    const brandRepo = manager.getRepository(Brand);
    const baseRepo = manager.getRepository(ProductsBase);
    const variantRepo = manager.getRepository(ProductVariant);
    const variantBranchRepo = manager.getRepository(ProductVariantBranch);

    let skuCounter = startSku;

    for (let i = 0; i < 150; i++) {
      skuCounter++;
      const currentCategoryData = categoriesData[i % categoriesData.length];
      const currentBrandName = brands[i % brands.length];
      const currentBaseName = currentCategoryData.bases[i % currentCategoryData.bases.length];
      const currentTemplate = variantsTemplates[i % variantsTemplates.length];

      // A. Buscar o crear Categoría
      let category = await categoryRepo.findOne({ 
        where: { name: currentCategoryData.name },
        relations: ['brands'] 
      });
      if (!category) {
        category = await categoryRepo.save(
          categoryRepo.create({ name: currentCategoryData.name, brands: [] })
        );
      }

      // B. Buscar o crear Marca
      let brand = await brandRepo.findOne({ where: { name: currentBrandName } });
      if (!brand) {
        brand = await brandRepo.save(
          brandRepo.create({ name: currentBrandName, description: `Productos de la marca ${currentBrandName}` })
        );
      }

      // C. Mantener la relación category_brands
      const hasRelation = category.brands.some(b => b.id === brand.id);
      if (!hasRelation) {
        category.brands.push(brand);
        await categoryRepo.save(category);
      }

      // D. Buscar o crear Producto Base
      const baseKeyName = `${currentBaseName} ${currentBrandName}`;
      let productBase = await baseRepo.findOne({ where: { name: baseKeyName } });
      if (!productBase) {
        productBase = await baseRepo.save(
          baseRepo.create({
            name: baseKeyName,
            description: `Línea base para ${baseKeyName}`,
            brand,
            category,
            isActive: true
          })
        );
      }

      // E. Crear variante única
      const sku = `${prefix}-${skuCounter}`;
      const calculatedCost = currentTemplate.cost * (0.9 + (i % 5) * 0.05);
      const salePrice = calculatedCost * currentTemplate.priceMultiplier;

      // Verificamos si la variante ya existe para no duplicar datos en reinicios
      let variant = await variantRepo.findOne({ where: { sku } });
      if (!variant) {
        variant = await variantRepo.save(
          variantRepo.create({
            sku,
            name: `${currentBaseName} ${currentBrandName} ${currentTemplate.name} M-${skuCounter}`,
            purchasePrice: Math.round(calculatedCost),
            price: Math.round(salePrice),
            minStock: 3,
            imgURL: 'https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg',
            productBase,
            isActive: true
          })
        );
      }

      // F. Vincular a la sucursal específica si no está vinculada ya
      const hasBranchAssignment = await variantBranchRepo.findOne({
        where: { variantId: variant.id, branchId: branch.id }
      });

      if (!hasBranchAssignment) {
        await variantBranchRepo.save(
          variantBranchRepo.create({
            variantId: variant.id,
            branchId: branch.id,
            isActive: true,
            variant,
            branch
          })
        );
      }
    }
  }
}