import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from 'src/branches/entities/branch.entity';
import { BranchType } from 'src/branches/entities/branch.entity';

@Injectable()
export class BranchSeeder implements OnModuleInit {
  private readonly logger = new Logger(BranchSeeder.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('🏪 Inicializando sucursales...');

      const branches = [
        {
          name: 'Sucursal Central',
          address: 'Av. Corrientes 1234, Buenos Aires',
          phone: '+54 11 1234-5678',
          email: 'central@electrotec.com',
          type: BranchType.BRANCH,
          openingHours: {
            monday: { open: '09:00', close: '18:00' },
            tuesday: { open: '09:00', close: '18:00' },
            wednesday: { open: '09:00', close: '18:00' },
            thursday: { open: '09:00', close: '18:00' },
            friday: { open: '09:00', close: '18:00' },
            saturday: { open: '09:00', close: '13:00' },
            sunday: { open: 'closed' }
          },
          openingBalance: 50000,
          isActive: true
        },
        {
          name: 'Sucursal Norte',
          address: 'Av. Cabildo 2500, Buenos Aires',
          phone: '+54 11 2345-6789',
          email: 'norte@electrotec.com',
          type: BranchType.BRANCH,
          openingHours: {
            monday: { open: '09:00', close: '18:00' },
            tuesday: { open: '09:00', close: '18:00' },
            wednesday: { open: '09:00', close: '18:00' },
            thursday: { open: '09:00', close: '18:00' },
            friday: { open: '09:00', close: '18:00' },
            saturday: { open: '09:00', close: '13:00' },
            sunday: { open: 'closed' }
          },
          openingBalance: 30000,
          isActive: true
        },
        {
          name: 'Sucursal Sur',
          address: 'Av. Rivadavia 3500, Buenos Aires',
          phone: '+54 11 3456-7890',
          email: 'sur@electrotec.com',
          type: BranchType.BRANCH,
          openingHours: {
            monday: { open: '09:00', close: '18:00' },
            tuesday: { open: '09:00', close: '18:00' },
            wednesday: { open: '09:00', close: '18:00' },
            thursday: { open: '09:00', close: '18:00' },
            friday: { open: '09:00', close: '18:00' },
            saturday: { open: '09:00', close: '13:00' },
            sunday: { open: 'closed' }
          },
          openingBalance: 25000,
          isActive: true
        },
        {
          name: 'Depósito Central',
          address: 'Ruta Panamericana Km 25, Buenos Aires',
          phone: '+54 11 4567-8901',
          email: 'deposito@electrotec.com',
          type: BranchType.WAREHOUSE,
          openingHours: {
            monday: { open: '08:00', close: '17:00' },
            tuesday: { open: '08:00', close: '17:00' },
            wednesday: { open: '08:00', close: '17:00' },
            thursday: { open: '08:00', close: '17:00' },
            friday: { open: '08:00', close: '17:00' },
            saturday: { open: '08:00', close: '12:00' },
            sunday: { open: 'closed' }
          },
          openingBalance: 100000,
          isActive: true
        }
      ];

      for (const branchData of branches) {
        const exists = await this.branchRepository.findOne({
          where: { name: branchData.name }
        });

        if (!exists) {
          const branch = this.branchRepository.create(branchData);
          await this.branchRepository.save(branch);
          this.logger.log(`✅ Sucursal creada: ${branchData.name}`);
        } else {
          this.logger.debug(`ℹ️ Sucursal ya existe: ${branchData.name}`);
        }
      }

      this.logger.log('🌱 Seed de sucursales completado correctamente');
    } catch (error) {
      this.logger.error(
        '❌ Error durante la inicialización de sucursales:',
        error
      );
    }
  }
}
