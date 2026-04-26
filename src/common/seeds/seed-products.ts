// import { ProductsBase } from "src/products-base/entities/products-base.entity";
// import { ProductVariant } from "src/products-variants/entities/products-variant.entity";
// import { InjectRepository } from "@nestjs/typeorm";
// import { Brand } from "src/brands/entities/brand.entity";
// import { Category } from "src/categories/entities/category.entity";
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { Repository } from "typeorm";
// import dataProducts from '../asset/data-products.json';

// @Injectable()
// export class InitialSeederProducts implements OnModuleInit {
//   private readonly logger = new Logger(InitialSeederProducts.name);

//   constructor(
//     @InjectRepository(ProductsBase)
//     private readonly baseRepo: Repository<ProductsBase>,

//     @InjectRepository(ProductVariant)
//     private readonly variantRepo: Repository<ProductVariant>,

//     @InjectRepository(Brand)
//     private readonly brandRepo: Repository<Brand>,

//     @InjectRepository(Category)
//     private readonly categoryRepo: Repository<Category>,
//   ) {}

//   async onModuleInit() {
//     this.logger.log("🌱 Iniciando seed de productos base + variantes...");

//     const list = (dataProducts as any).default ?? dataProducts;

//     for (const item of list) {
//       const name = item.name.trim().toUpperCase();

//       const existing = await this.baseRepo.findOne({
//         where: { name },
//         relations: ["variants"]
//       });

//       if (existing) {
//         this.logger.debug(`↩️ Producto base ya existe: ${name}`);
//         continue;
//       }

//       // Buscar marca
//       const brand = await this.brandRepo.findOne({
//         where: { name: item.brand.trim().toUpperCase() }
//       });

//       // Buscar categoría
//       const category = await this.categoryRepo.findOne({
//         where: { name: item.category.trim().toUpperCase() },
//         relations: ["brands"]
//       });

//       if (!brand || !category) {
//         this.logger.error(`❌ Marca o categoría no encontrada: ${item.name}`);
//         continue;
//       }

//       // Asegurar relación ManyToMany Category <-> Brand
//       if (!category.brands.some(b => b.id === brand.id)) {
//         category.brands.push(brand);
//         await this.categoryRepo.save(category);
//       }

//       // Crear ProductBase
//       const base = this.baseRepo.create({
//         name,
//         description: item.description,
//         brand,
//         variants: []
//       });

//       const savedBase = await this.baseRepo.save(base);

//       this.logger.log(`🟠 Creado ProductBase: ${savedBase.name}`);

//       // Insertar Variants
//       for (const v of item.variants) {
//         const variant = this.variantRepo.create({
//           name: v.name.trim().toUpperCase(),
//           price: v.price,
//           stock: v.stock,
//           imgURL: "https://png.pngtree.com/png-vector/20221125/ourmid/pngtree-no-image-available-icon-flatvector-illustration-pic-design-profile-vector-png-image_40966566.jpg",
//           productBase: savedBase
//         });

//         await this.variantRepo.save(variant);

//         this.logger.log(`   ➕ Variante: ${variant.name}`);
//       }
//     }

//     this.logger.log("✅ Seed de productos completado.");
//   }
// }
