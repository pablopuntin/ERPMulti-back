//Preparado con .env para produccion mas adelante
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/users/entities/role.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class InitialSeeder implements OnModuleInit {
  private readonly logger = new Logger(InitialSeeder.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>
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

      this.logger.log('🌱 Seed completado correctamente');
    } catch (error) {
      this.logger.error('❌ Error durante la inicialización de seeds:', error);
    }
  }
}
