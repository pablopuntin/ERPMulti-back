import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const nameUpper = createCategoryDto.name.toUpperCase();
    const descriptionUpper = createCategoryDto.description?.toUpperCase();

    // Verificamos duplicados en categorías
    const existing = await this.categoryRepository.findOne({
      where: { name: nameUpper }
    });
    if (existing) {
      throw new Error(`La categoría ${nameUpper} ya existe`);
    }

    // Creamos nueva categoría
    const newCategory = new Category();
    newCategory.name = nameUpper;
    if (descriptionUpper) {
      newCategory.description = descriptionUpper;
    }

    await this.categoryRepository.save(newCategory);

    return 'Categoría creada';
  }

  
  //refactor, findall solo muestra pos activos
  async findAll() {
    const categories = await this.categoryRepository.find({
      where: { isActive: true }
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description
    }));
  }

  
  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['brands']
    });

    if (!category) throw new NotFoundException('Categoría no encontrada');

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException('No se encontro el usuario con el id "{id}');
    }

    const updated = Object.assign(category, updateCategoryDto);
    const savedCategory = await this.categoryRepository.save(updated);

    return category;
  }

  async remove(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: [
        'brands',
        'brands.categories',
        'brands.productsBase',
        'brands.productsBase.variants'
      ]
    });

    if (!category) throw new NotFoundException('Categoría no encontrada');

    // 🔸 Desactivar la categoría
    category.isActive = false;
    await this.categoryRepository.save(category);

    // 🔸 Revisar cada marca asociada
    for (const brand of category.brands) {
      // Quitamos la relación entre la categoría y la marca
      brand.categories = brand.categories.filter((c) => c.id !== category.id);

      // Si la marca ya no pertenece a ninguna categoría → desactivarla
      if (brand.categories.length === 0) {
        brand.isActive = false;
        await this.categoryRepository.manager.save(brand);

        // Desactivar sus productos y variantes
        for (const productBase of brand.productsBase) {
          productBase.isActive = false;
          await this.categoryRepository.manager.save(productBase);

          for (const variant of productBase.variants) {
            variant.isActive = false;
            await this.categoryRepository.manager.save(variant);
          }
        }
      } else {
        // Si la marca todavía pertenece a otras categorías, solo actualizamos sus relaciones
        await this.categoryRepository.manager.save(brand);
      }
    }

    return {
      message: `Categoría "${category.name}" desactivada correctamente.`
    };
  }

  async findInactive() {
    const categories = await this.categoryRepository.find({
      where: { isActive: false }
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      imgURL: cat.imgURL
    }));
  }

  async restore(id: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    if (category.isActive) {
      throw new BadRequestException('La categoría ya está activa');
    }

    category.isActive = true;
    await this.categoryRepository.save(category);

    // También podrías considerar reactivar marcas y productos relacionados,
    // si eso tiene sentido para tu lógica de negocio.

    return {
      message: `Categoría "${category.name}" restaurada correctamente.`
    };
  }

 

  async findBrandsByCategory(categoryId: string) {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, isActive: true },
      relations: ['brands']
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category.brands.filter((b) => b.isActive);
  }
}
