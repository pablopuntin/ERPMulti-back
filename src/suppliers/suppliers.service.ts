// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Supplier } from './entities/supplier.entity';
// import { SupplierProduct } from './entities/supplier-product.entity';
// import { CreateSupplierDto } from './dto/create-supplier.dto';
// import { UpdateSupplierDto } from './dto/update-supplier.dto';
// import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
// import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';
// import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';

// @Injectable()
// export class SuppliersService {
//   constructor(
//     @InjectRepository(Supplier)
//     private readonly supplierRepo: Repository<Supplier>,

//     @InjectRepository(SupplierProduct)
//     private readonly supplierProductRepo: Repository<SupplierProduct>,

//     @InjectRepository(ProductVariant)
//     private readonly variantRepo: Repository<ProductVariant>,
//   ) {}

//   // ===== SUPPLIERS =====

//   async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
//     const supplier = this.supplierRepo.create(dto);
//     return this.supplierRepo.save(supplier);
//   }

//   async findAllSuppliers(): Promise<Supplier[]> {
//     return this.supplierRepo.find({ relations: ['suppliedProducts'] });
//   }

//   async findOneSupplier(id: string): Promise<Supplier> {
//     const supplier = await this.supplierRepo.findOne({
//       where: { id },
//       relations: ['suppliedProducts'],
//     });
//     if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
//     return supplier;
//   }

//   async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
//     await this.supplierRepo.update(id, dto);
//     return this.findOneSupplier(id);
//   }

//   async removeSupplier(id: string): Promise<void> {
//     const result = await this.supplierRepo.delete(id);
//     if (result.affected === 0) throw new NotFoundException(`Supplier ${id} not found`);
//   }

//   // ===== SUPPLIER PRODUCTS =====

//   async addProductToSupplier(dto: CreateSupplierProductDto): Promise<SupplierProduct> {
//     const supplier = await this.findOneSupplier(dto.supplierId);
//     const variant = await this.variantRepo.findOne({ where: { id: dto.variantId } });
//     if (!variant) throw new NotFoundException(`Variant ${dto.variantId} not found`);

//     const supplierProduct = this.supplierProductRepo.create({
//       ...dto,
//       supplier,
//       variant,
//     });

//     return this.supplierProductRepo.save(supplierProduct);
//   }

//   async updateSupplierProduct(id: string, dto: UpdateSupplierProductDto): Promise<SupplierProduct> {
//     const supplierProduct = await this.supplierProductRepo.findOne({ where: { id } });
//     if (!supplierProduct) throw new NotFoundException(`SupplierProduct ${id} not found`);

//     Object.assign(supplierProduct, dto);
//     return this.supplierProductRepo.save(supplierProduct);
//   }

//   async removeSupplierProduct(id: string): Promise<void> {
//     const result = await this.supplierProductRepo.delete(id);
//     if (result.affected === 0) throw new NotFoundException(`SupplierProduct ${id} not found`);
//   }
// }

//refactor
import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';
import { CreatePurchaseDto } from 'src/purchase/dto/create-purchase.dto';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { StockService } from 'src/stock/stock.service';
import { StockMovementType } from 'src/stock/entities/stock.entity';
import { CashService } from 'src/cash/cash.service';
import { CashMovementType } from 'src/cash/entities/cash-movement.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepo: Repository<SupplierProduct>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly stockService: StockService,
    private readonly cashService: CashService
  ) {}

  // ======================================
  //         CRUD DE PROVEEDORES
  // ======================================
  async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepo.create(dto);
    return this.supplierRepo.save(supplier);
  }

  async findAllSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.find({ relations: ['suppliedProducts'] });
  }

  async findOneSupplier(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id },
      relations: ['suppliedProducts']
    });

    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    await this.supplierRepo.update(id, dto);
    return this.findOneSupplier(id);
  }

  async removeSupplier(id: string): Promise<void> {
    const result = await this.supplierRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Supplier ${id} not found`);
  }

  // ======================================
  //       1:N PRODUCTOS DEL PROVEEDOR
  // ======================================
  async addProductToSupplier(
    dto: CreateSupplierProductDto
  ): Promise<SupplierProduct> {
    const supplier = await this.findOneSupplier(dto.supplierId);
    const variant = await this.variantRepo.findOne({
      where: { id: dto.variantId }
    });
    if (!variant)
      throw new NotFoundException(`Variant ${dto.variantId} not found`);

    const supplierProduct = this.supplierProductRepo.create({
      ...dto,
      supplier,
      variant
    });

    return this.supplierProductRepo.save(supplierProduct);
  }

  async updateSupplierProduct(
    id: string,
    dto: UpdateSupplierProductDto
  ): Promise<SupplierProduct> {
    const supplierProduct = await this.supplierProductRepo.findOne({
      where: { id }
    });
    if (!supplierProduct)
      throw new NotFoundException(`SupplierProduct ${id} not found`);

    Object.assign(supplierProduct, dto);

    return this.supplierProductRepo.save(supplierProduct);
  }

  async removeSupplierProduct(id: string): Promise<void> {
    const result = await this.supplierProductRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`SupplierProduct ${id} not found`);
  }
}
