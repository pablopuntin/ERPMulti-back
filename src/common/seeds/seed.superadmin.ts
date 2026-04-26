//Preparado con .env para produccion mas adelante
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/users/entities/role.entity';
import { User } from 'src/users/entities/user.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import {
  BranchUser,
  BranchUserRole
} from 'src/branches/entities/branch-user.entity';

@Injectable()
export class InitialSeeder implements OnModuleInit {
  private readonly logger = new Logger(InitialSeeder.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('🚀 Inicializando roles y superadmin...');

      // 1️⃣ Crear roles base si no existen
      const baseRoles = [
        {
          name: 'root',
          description: 'Super administrador del sistema - acceso total'
        },
        {
          name: 'gerente_general',
          description:
            'Gerente general - acceso global o por sucursales asignadas'
        },
        {
          name: 'gerente_sucursal',
          description:
            'Gerente de sucursal - gestión operativa de sus sucursales asignadas'
        },
        {
          name: 'vendedor',
          description: 'Vendedor - crea ventas y presupuestos'
        },
        {
          name: 'cajero',
          description: 'Cajero - finaliza ventas y gestiona caja'
        }
      ];

      for (const roleData of baseRoles) {
        const exists = await this.roleRepository.findOne({
          where: { name: roleData.name }
        });
        if (!exists) {
          await this.roleRepository.save(this.roleRepository.create(roleData));
          this.logger.log(`✅ Rol creado: ${roleData.name}`);
        }
      }

      // 2️⃣ Crear root inicial si no existe
      const rootEmail = process.env.ROOT_EMAIL || 'root@electrotec.com';
      const rootPassword =
        process.env.ROOT_PASSWORD || 'RootSecurePassword123!';

      const root = await this.userRepository.findOne({
        where: { email: rootEmail },
        relations: ['roles'] // ✅ OJO: debe coincidir con tu propiedad "roles" en la entidad
      });

      if (!root) {
        const rootRole = await this.roleRepository.findOne({
          where: { name: 'root' }
        });

        if (!rootRole) {
          throw new Error('❌ No se encontró el rol "root".');
        }

        const passwordHash = await bcrypt.hash(rootPassword, 10);

        const newRoot = this.userRepository.create({
          email: rootEmail,
          password: passwordHash,
          firstname: 'System',
          lastname: 'Root',
          roles: [rootRole]
        });

        await this.userRepository.save(newRoot);
        this.logger.log(
          `✅ Root creado: ${rootEmail} (puedes cambiarlo en .env)`
        );
      } else {
        this.logger.debug('ℹ️ Root ya existe, no se crea otro.');
      }

      const generalManagerEmail = process.env.GENERAL_MANAGER_EMAIL?.trim();
      const generalManagerPassword =
        process.env.GENERAL_MANAGER_PASSWORD?.trim();

      if (generalManagerEmail && generalManagerPassword) {
        const existingGeneralManager = await this.userRepository.findOne({
          where: { email: generalManagerEmail },
          relations: ['roles', 'branchAssignments', 'branchAssignments.branch']
        });

        if (!existingGeneralManager) {
          const generalManagerRole = await this.roleRepository.findOne({
            where: { name: 'gerente_general' }
          });

          if (!generalManagerRole) {
            throw new Error('❌ No se encontró el rol "gerente_general".');
          }

          const requestedBranchIds = (process.env.GENERAL_MANAGER_BRANCH_IDS || '')
            .split(',')
            .map((branchId) => branchId.trim())
            .filter(Boolean);
          const globalBranchAccess =
            process.env.GENERAL_MANAGER_GLOBAL_BRANCH_ACCESS === 'true';

          let assignedBranches: Branch[] = [];

          if (requestedBranchIds.length > 0) {
            assignedBranches = await this.branchRepository.find({
              where: requestedBranchIds.map((id) => ({ id, isActive: true }))
            });

            if (assignedBranches.length !== requestedBranchIds.length) {
              throw new Error(
                '❌ GENERAL_MANAGER_BRANCH_IDS contiene sucursales inexistentes o inactivas.'
              );
            }
          } else if (globalBranchAccess) {
            assignedBranches = await this.branchRepository.find({
              where: { isActive: true },
              order: { name: 'ASC' }
            });
          }

          if (assignedBranches.length === 0) {
            this.logger.warn(
              '⚠️ No se creó el gerente general porque no hay sucursales activas asignables. Definí GENERAL_MANAGER_BRANCH_IDS o activá sucursales.'
            );
          } else {
            const passwordHash = await bcrypt.hash(generalManagerPassword, 10);
            const firstname =
              process.env.GENERAL_MANAGER_FIRSTNAME?.trim() || 'Gerente';
            const lastname =
              process.env.GENERAL_MANAGER_LASTNAME?.trim() || 'General';

            const newGeneralManager = this.userRepository.create({
              email: generalManagerEmail,
              password: passwordHash,
              firstname,
              lastname,
              roles: [generalManagerRole]
            });

            const savedGeneralManager = await this.userRepository.save(
              newGeneralManager
            );

            const assignments = assignedBranches.map((branch) =>
              this.branchUserRepository.create({
                user: savedGeneralManager,
                branch,
                role: BranchUserRole.GENERAL_MANAGER,
                isActive: true,
                permissions: {
                  canViewAllBranches: globalBranchAccess,
                  canManageProducts: true,
                  canManageUsers: true,
                  canViewReports: true,
                  canManageCash: true,
                  canManageExpenses: true
                },
                notes: 'Seed automático de gerente general'
              })
            );

            await this.branchUserRepository.save(assignments);
            this.logger.log(
              `✅ Gerente general creado: ${generalManagerEmail}`
            );
          }
        } else {
          this.logger.debug(
            'ℹ️ El gerente general configurado ya existe, no se crea otro.'
          );
        }
      }

      this.logger.log('🌱 Seed completado correctamente');
    } catch (error) {
      this.logger.error('❌ Error durante la inicialización de seeds:', error);
    }
  }
}
