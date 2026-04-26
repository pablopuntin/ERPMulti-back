import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceChangeHistory } from './entities/price-history.entity';

@Injectable()
export class PriceHistoryService {
  constructor(
    @InjectRepository(PriceChangeHistory)
    private readonly historyRepo: Repository<PriceChangeHistory>
  ) {}

  async recordChange(data: {
    variant: any;
    oldPrice: number;
    newPrice: number;
    changedBy?: any;
    source: 'manual' | 'rule' | 'system';
    priceRule?: any;
  }) {
    const entry = this.historyRepo.create(data);
    return this.historyRepo.save(entry);
  }

  async findAll() {
    return this.historyRepo.find({ order: { changedAt: 'DESC' } });
  }

  async findByVariant(variantId: string) {
    return this.historyRepo.find({
      where: { variant: { id: variantId } },
      order: { changedAt: 'DESC' }
    });
  }
}
