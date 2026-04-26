import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

@Injectable()
export class ProductImagesService {
  constructor(
    @InjectRepository(ProductImage)
    private readonly imageRepo: Repository<ProductImage>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>
  ) {}

  async create(dto: CreateProductImageDto): Promise<ProductImage> {
    const variant = await this.variantRepo.findOne({
      where: { id: dto.variantId }
    });
    if (!variant)
      throw new NotFoundException(`Variant ${dto.variantId} not found`);

    const image = this.imageRepo.create({
      ...dto,
      variant
    });

    // si esMain = true, desactivar otras principales de esta variante
    if (dto.isMain) {
      await this.imageRepo.update({ variant }, { isMain: false });
    }

    return this.imageRepo.save(image);
  }

  async findAll(): Promise<ProductImage[]> {
    return this.imageRepo.find({
      relations: ['variant'],
      order: { order: 'ASC' }
    });
  }

  async findByVariant(variantId: string): Promise<ProductImage[]> {
    return this.imageRepo.find({
      where: { variant: { id: variantId } },
      order: { order: 'ASC' }
    });
  }

  async findOne(id: string): Promise<ProductImage> {
    const image = await this.imageRepo.findOne({
      where: { id },
      relations: ['variant']
    });
    if (!image) throw new NotFoundException(`Image ${id} not found`);
    return image;
  }

  async update(id: string, dto: UpdateProductImageDto): Promise<ProductImage> {
    const image = await this.findOne(id);

    // si cambia la imagen principal, actualizar el resto
    if (dto.isMain) {
      await this.imageRepo.update(
        { variant: image.variant },
        { isMain: false }
      );
    }

    Object.assign(image, dto);
    return this.imageRepo.save(image);
  }

  async remove(id: string): Promise<void> {
    const image = await this.findOne(id);
    await this.imageRepo.remove(image);
  }
}
