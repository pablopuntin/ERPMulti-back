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
