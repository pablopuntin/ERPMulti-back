import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { StockLocation } from './entities/stock-location.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>
  ) {}

  async create(createBranchDto: CreateBranchDto) {
    const branch = this.branchRepository.create(createBranchDto);
    return await this.branchRepository.save(branch);
  }

  async findAll() {
    return await this.branchRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' }
    });
  }

  async findOne(id: string) {
    const branch = await this.branchRepository.findOne({
      where: { id, isActive: true },
      relations: ['stockLocations', 'branchUsers']
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(id: string, updateBranchDto: Partial<CreateBranchDto>) {
    const branch = await this.findOne(id);

    Object.assign(branch, updateBranchDto);
    return await this.branchRepository.save(branch);
  }

  async getSalesSettings(id: string) {
    const branch = await this.findOne(id);

    return {
      id: branch.id,
      name: branch.name,
      restrictSalesToBranchStock: Boolean(branch.restrictSalesToBranchStock)
    };
  }

  async updateSalesSettings(
    id: string,
    updateData: { restrictSalesToBranchStock: boolean }
  ) {
    const branch = await this.findOne(id);

    branch.restrictSalesToBranchStock = Boolean(
      updateData.restrictSalesToBranchStock
    );

    const saved = await this.branchRepository.save(branch);

    return {
      id: saved.id,
      name: saved.name,
      restrictSalesToBranchStock: Boolean(saved.restrictSalesToBranchStock)
    };
  }

  async remove(id: string) {
    const branch = await this.findOne(id);
    branch.isActive = false;
    return await this.branchRepository.save(branch);
  }

  // Métodos para stock locations
  async getStockByBranch(branchId: string) {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
      relations: ['stockLocations', 'stockLocations.productVariant']
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch.stockLocations;
  }

  async getLowStockItems(branchId: string) {
    const stockLocations = await this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.stockLocations', 'stockLocation')
      .leftJoinAndSelect('stockLocation.productVariant', 'productVariant')
      .leftJoinAndSelect('productVariant.productBase', 'productBase')
      .where('branch.id = :branchId', { branchId })
      .andWhere('stockLocation.quantity <= stockLocation.minStock')
      .andWhere('stockLocation.isActive = :isActive', { isActive: true })
      .getMany();

    return stockLocations;
  }
}
