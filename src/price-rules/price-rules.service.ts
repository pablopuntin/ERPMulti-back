// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
// import { PriceRule } from './entities/price-rule.entity';
// import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
// import { PriceHistoryService } from 'src/price-history/price-history.service';

// @Injectable()
// export class PriceRulesService {
//   constructor(
//     @InjectRepository(PriceRule)
//     private readonly ruleRepo: Repository<PriceRule>,
//     @InjectRepository(ProductVariant)
//     private readonly variantRepo: Repository<ProductVariant>,
//     private readonly priceHistoryService: PriceHistoryService,
//   ) {}

//   async applyActiveRules() {
//     const now = new Date();

//     const rules = await this.ruleRepo.find({
//       where: {
//         startDate: LessThanOrEqual(now),
//         endDate: MoreThanOrEqual(now),
//         isActive: true,
//       },
//       relations: ['brand', 'category'],
//     });

//     for (const rule of rules) {
//       const where: any = {};
//       if (rule.brand) where.productBase = { brand: { id: rule.brand.id } };
//       if (rule.category) where.productBase = { category: { id: rule.category.id } };

//       const variants = await this.variantRepo.find({ where });

//       for (const variant of variants) {
//         const oldPrice = variant.price;
//         const newPrice = +(oldPrice * (1 + rule.percentage / 100)).toFixed(2);

//         variant.price = newPrice;
//         await this.variantRepo.save(variant);

//         await this.priceHistoryService.recordChange({
//           variant,
//           oldPrice,
//           newPrice,
//           source: 'rule',
//           priceRule: rule,
//         });
//       }
//     }

//     return { message: 'Active price rules applied successfully' };
//   }
// }

//refactor
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { PriceRule } from './entities/price-rule.entity';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { CreatePriceRuleDto } from './dto/create-price-rule.dto';
import { UpdatePriceRuleDto } from './dto/update-price-rule.dto';
import { PriceHistoryService } from 'src/price-history/price-history.service';
import { Brand } from 'src/brands/entities/brand.entity';
import { Category } from 'src/categories/entities/category.entity';
import { User } from 'src/users/entities/user.entity';
import { IsNull } from 'typeorm';

@Injectable()
export class PriceRulesService {
  constructor(
    @InjectRepository(PriceRule)
    private readonly ruleRepo: Repository<PriceRule>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly priceHistoryService: PriceHistoryService
  ) {}

  // ➤ Crear regla
  async create(dto: CreatePriceRuleDto) {
    const rule = this.ruleRepo.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate)
    });

    if (dto.brandId) {
      rule.brand =
        (await this.brandRepo.findOneBy({ id: dto.brandId })) ?? undefined;
    }

    if (dto.categoryId) {
      rule.category =
        (await this.categoryRepo.findOneBy({ id: dto.categoryId })) ??
        undefined;
    }

    if (dto.createdById) {
      rule.createdBy =
        (await this.userRepo.findOneBy({ id: dto.createdById })) ?? undefined;
    }

    return this.ruleRepo.save(rule);
  }

  // ➤ Obtener todas las reglas
  async findAll() {
    return this.ruleRepo.find({
      relations: ['brand', 'category', 'createdBy'],
      order: { createdAt: 'DESC' }
    });
  }

  // ➤ Obtener regla por id
  async findOne(id: string) {
    const rule = await this.ruleRepo.findOne({
      where: { id },
      relations: ['brand', 'category', 'createdBy']
    });

    if (!rule) {
      throw new NotFoundException('Regla de precio no encontrada');
    }

    return rule;
  }

  // ➤ Actualizar regla
  async update(id: string, dto: UpdatePriceRuleDto) {
    const rule = await this.findOne(id);

    Object.assign(rule, dto);

    return this.ruleRepo.save(rule);
  }

  // ➤ Eliminar regla
  async remove(id: string) {
    const rule = await this.findOne(id);
    await this.ruleRepo.remove(rule);
    return { message: 'Regla eliminada correctamente' };
  }

  // ➤ Aplicar reglas activas una sola vez
  async applyActiveRules() {
    const now = new Date();

    const rules = await this.ruleRepo.find({
      where: {
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now),
        isActive: true,
        appliedAt: IsNull() // 👈 evita reaplicar reglas
      },
      relations: ['brand', 'category']
    });

    for (const rule of rules) {
      const where: any = {};

      if (rule.brand) {
        where.productBase = { brand: { id: rule.brand.id } };
      }

      if (rule.category) {
        where.productBase = { category: { id: rule.category.id } };
      }

      const variants = await this.variantRepo.find({ where });

      for (const variant of variants) {
        const oldPrice = variant.price;
        const newPrice = +(oldPrice * (1 + rule.percentage / 100)).toFixed(2);

        variant.price = newPrice;
        await this.variantRepo.save(variant);

        await this.priceHistoryService.recordChange({
          variant,
          oldPrice,
          newPrice,
          source: 'rule',
          priceRule: rule
        });
      }

      // 👇 Marcar la regla como aplicada
      rule.appliedAt = new Date();
      await this.ruleRepo.save(rule);
    }

    return { message: 'Reglas aplicadas', rulesExecuted: rules.length };
  }
}
