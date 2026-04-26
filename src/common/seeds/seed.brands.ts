// // import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// // import { InjectRepository } from '@nestjs/typeorm';
// // import { Repository } from 'typeorm';
// // import { Brand } from 'src/brands/entities/brand.entity';
// // import dataBrands from '../asset/data-brands.json';

// // @Injectable()
// // export class InitialSeederBrand implements OnModuleInit {
// //   private readonly logger = new Logger(InitialSeederBrand.name);

// //   constructor(
// //     @InjectRepository(Brand)
// //     private readonly brandsRepository: Repository<Brand>,
// //   ) {}

// //   async onModuleInit() {
// //     try {
// //       this.logger.log('🚀 Inicializando marcas...');

// //       // Normalizamos la data (por si viene en default)
// //       const list = (dataBrands as any).default ?? dataBrands;

// //       // Pasamos todos los nombres a mayúsculas antes de comparar
// //       const normalizedList = (list as { name: string; description: string }[]).map(
// //         (el) => ({
// //           name: el.name.trim().toUpperCase(),
// //           description: el.description ? el.description.trim().toUpperCase() : '',
// //         }),
// //       );

// //       // Obtenemos todas las marcas existentes
// //       const existing = await this.brandsRepository.find();
// //       const existingNames = existing.map((b) => b.name.toUpperCase());

// //       // Si ya están todas cargadas, cancelamos
// //       const allExist = normalizedList.every((el) => existingNames.includes(el.name));
// //       if (allExist) {
// //         this.logger.log('✅ Todas las marcas ya existen. Seed detenido.');
// //         return;
// //       }

// //       // Si faltan algunas, insertamos solo las nuevas
// //       for (const element of normalizedList) {
// //         if (!existingNames.includes(element.name)) {
// //           try {
// //             const saved = await this.brandsRepository.save(
// //               this.brandsRepository.create({
// //                 name: element.name,
// //                 description: element.description,
// //               }),
// //             );
// //             this.logger.log(`🌱 Creada marca: ${saved.name}`);
// //           } catch (err) {
// //             this.logger.error(`❌ Error al guardar ${element.name}: ${err.message}`);
// //           }
// //         } else {
// //           this.logger.debug(`↩️ Ya existe: ${element.name}`);
// //         }
// //       }

// //       this.logger.log('🌿 Seed de marcas completado correctamente');
// //     } catch (error) {
// //       this.logger.error('❌ Error en el seeder de marcas:', error);
// //     }
// //   }
// // }

// //refactor
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Brand } from 'src/brands/entities/brand.entity';
// import dataBrands from '../asset/data-brands.json';

// @Injectable()
// export class InitialSeederBrands implements OnModuleInit {
//   private readonly logger = new Logger(InitialSeederBrands.name);

//   constructor(
//     @InjectRepository(Brand)
//     private readonly brandRepo: Repository<Brand>
//   ) {}

//   async onModuleInit() {
//     this.logger.log("🌱 Iniciando seed de marcas...");

//     const list = (dataBrands as any).default ?? dataBrands;

//     for (const item of list) {
//       const name = item.name.trim().toUpperCase();

//       const exists = await this.brandRepo.findOne({ where: { name } });

//       if (exists) {
//         this.logger.debug(`↩️ Marca ya existe: ${name}`);
//         continue;
//       }

//       const saved = await this.brandRepo.save(
//         this.brandRepo.create({
//           name,
//           description: item.description?.trim()
//         })
//       );

//       this.logger.log(`🟦 Creada marca: ${saved.name}`);
//     }

//     this.logger.log("✅ Seed de marcas completado.");
//   }
// }
