// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Brand } from './entities/brand.entity';
// import { CreateBrandDto } from './dto/create-brand.dto';
// import { UpdateBrandDto } from './dto/update-brand.dto';
// import { Category } from 'src/categories/entities/category.entity';

// @Injectable()
// export class BrandsService {
//   constructor(
//       @InjectRepository(Brand)
//       private readonly brandRepository: Repository<Brand>,
//       @InjectRepository(Category)
//       private readonly categoryRepository: Repository<Category>) {}

// async createBrand(createBrandDto: CreateBrandDto) {
//   const nameUpper = createBrandDto.name.toUpperCase();
//   const descriptionUpper = createBrandDto.description?.toUpperCase();

//   // ❌ Verificación si la marca ya existe
//   const existing = await this.brandRepository.findOne({
//     where: { name: nameUpper },
//   });

//   if (existing) {
//     throw new Error(`La marca ${nameUpper} ya existe`);
//   }

//   // ✔ Buscar categorías por sus IDs
//   const categories = await this.categoryRepository.findByIds(
//     createBrandDto.categoryIds
//   );

//   if (categories.length !== createBrandDto.categoryIds.length) {
//     throw new NotFoundException(
//       "Una o más categorías no existen"
//     );
//   }

//   // ✔ Crear marca
//   const newBrand = this.brandRepository.create({
//     name: nameUpper,
//     description: descriptionUpper,
//     imgURL: createBrandDto.imgURL,
//     categories, // ← asociaciones ManyToMany
//   });

//   await this.brandRepository.save(newBrand);

//   return {
//     message: "Marca creada correctamente",
//     brand: newBrand,
//   };
// }

//  async findAllBrand() {
//   const brands = await this.brandRepository.find();

//   return brands.map(b => ({
//     id: b.id,
//     name: b.name,
//     description: b.description,
//   }));
// }

//   async findOne(id: string) {
//     const variant = await this.brandRepository.findOne({
//       where: { id },
//       relations: ["productBase", "supplierProducts"],
//     });
//     if (!variant) throw new NotFoundException("Variante no encontrada");
//     return variant;
//   }

//    async update(id: string, updateBrandDto: UpdateBrandDto) {
//    const category = await this.brandRepository.findOne({where: {id}});

//      if (!category){
//        throw new NotFoundException('No se encontro el usuario con el id "{id}');
//      }

//      const updated = Object.assign(category, updateBrandDto);
//      const savedCategory = await this.brandRepository.save(updated);

//      return category;
//    }

// async remove(id: string) {
//   // 1️⃣ Buscar la marca con sus relaciones
//   const brand = await this.brandRepository.findOne({
//     where: { id },
//     relations: [
//       'categories',
//       'productsBase',
//       'productsBase.variants',
//     ],
//   });

//   if (!brand) {
//     throw new NotFoundException(`La marca con id ${id} no existe`);
//   }

//   // 2️⃣ Desactivar la marca
//   brand.isActive = false;
//   await this.brandRepository.save(brand);

//   // 3️⃣ Desactivar todos los productos base de la marca
//   for (const productBase of brand.productsBase) {
//     productBase.isActive = false;
//     await this.brandRepository.manager.save(productBase);

//     // 4️⃣ Desactivar todas las variantes de cada producto base
//     for (const variant of productBase.variants) {
//       variant.isActive = false;
//       await this.brandRepository.manager.save(variant);
//     }
//   }

//   return { message: `Marca "${brand.name}" desactivada correctamente.` };
// }

//  async findProductsBaseByBrand(brandId: string) {
//   const brand = await this.brandRepository.findOne({
//     where: { id: brandId, isActive: true },
//     relations: ['productsBase', 'productsBase.variants'],
//   });

//   if (!brand) throw new NotFoundException('Marca no encontrada');

//   return {
//     id: brand.id,
//     name: brand.name,
//     imgURL: brand.imgURL,
//     productsBase: brand.productsBase
//       .filter(pb => pb.isActive)
//       .map(pb => ({
//         id: pb.id,
//         name: pb.name,
//         description: pb.description,
//         variants: pb.variants?.filter(v => v.isActive) ?? []
//       }))
//   };
// }

// }

//refactor
import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';
import { Category } from 'src/categories/entities/category.entity';
import { CreateBrandDto } from './dto/create-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>
  ) {}

  async createBrand(dto: CreateBrandDto) {
    const nameUpper = dto.name.trim().toUpperCase();

    const exists = await this.brandRepo.findOne({ where: { name: nameUpper } });
    if (exists)
      throw new BadRequestException(`La marca "${nameUpper}" ya existe`);

    let category: Category | undefined;

    if (dto.categoryId) {
      const categoryFound = await this.categoryRepo.findOne({
        where: { id: dto.categoryId }
      });
      if (!categoryFound)
        throw new NotFoundException('Categoría no encontrada');

      category = categoryFound;
    }

    const brand = this.brandRepo.create({
      name: nameUpper,
      description: dto.description?.trim(),
      imgURL: dto.imgURL,
      categories: category ? [category] : []
    });

    return await this.brandRepo.save(brand);
  }

  async findAll() {
    return await this.brandRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' }
    });
  }

  async associateBrandToCategory(brandId: string, categoryId: string) {
    const brand = await this.brandRepo.findOne({
      where: { id: brandId },
      relations: ['categories']
    });
    if (!brand) throw new NotFoundException('Marca no encontrada');

    const category = await this.categoryRepo.findOne({
      where: { id: categoryId },
      relations: ['brands']
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const already = brand.categories?.some((c) => c.id === categoryId);
    if (already)
      throw new BadRequestException(
        'La marca ya está asociada a esta categoría'
      );

    brand.categories.push(category);

    return await this.brandRepo.save(brand);
  }

  async findOne(id: string) {
    const brand = await this.brandRepo.findOne({
      where: { id },
      relations: ['categories', 'productsBase', 'productsBase.variants']
    });

    if (!brand) throw new NotFoundException('Marca no encontrada');

    return brand;
  }

  //metodo para obtener productosbase asociados a brand
  async findProductsBaseByBrand(brandId: string) {
    const brand = await this.brandRepo.findOne({
      where: { id: brandId, isActive: true },
      relations: ['productsBase']
    });

    if (!brand) throw new NotFoundException('Marca no encontrada');

    return brand.productsBase.filter((pb) => pb.isActive);
  }
}
