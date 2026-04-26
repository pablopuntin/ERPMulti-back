import {
  Injectable,
  NestMiddleware,
  UnauthorizedException
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchUser } from '../../branches/entities/branch-user.entity';

@Injectable()
export class BranchValidationMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const requestPath = req.path || req.originalUrl;
      console.log('🔍 Middleware - Validando ruta protegida:', requestPath);

      // 1️⃣ Obtener datos del token JWT
      const user = req.user as any;
      if (!user || !user.sub) {
        console.log('❌ Middleware - Token inválido o usuario no encontrado');
        throw new UnauthorizedException('Invalid token');
      }

      // 2️⃣ Si es usuario root, tiene acceso total sin validación de sucursal
      if (user.roles && user.roles.includes('root')) {
        console.log(
          '👑 Middleware - Usuario ROOT detectado, acceso total sin validación de sucursal'
        );
        req.currentBranch = 'all'; // Indica acceso a todas las sucursales
        req.branchPermissions = ['read', 'write', 'delete', 'admin'];
        return next();
      }

      // 3️⃣ Para otros roles, validar branch ID del header
      const branchId = req.headers['x-branch-id'] as string;
      if (!branchId) {
        console.log(
          '❌ Middleware - Branch ID requerido para usuarios no-root'
        );
        throw new UnauthorizedException('Branch ID required');
      }

      console.log('✅ Middleware - Validando acceso:', {
        user: user.sub,
        branch: branchId,
        role: user.roles[0]
      });

      // 4️⃣ Validación híbrida: Aleatoria + Estratégica
      const isValid = await this.validateBranchAccess(
        user.sub,
        branchId,
        user.roles[0]
      );

      if (!isValid) {
        throw new UnauthorizedException('Access denied for this branch');
      }

      // 4️⃣ Agregar info de branch al request
      req.currentBranch = branchId;
      req.branchPermissions = await this.getUserPermissions(user.roles[0]);

      next();
    } catch (error) {
      console.log('🔍 Branch Validation Error:', error.message);
      res.status(401).json({
        message: 'Branch validation failed',
        error: error.message
      });
    }
  }

  private async validateBranchAccess(
    userId: string,
    branchId: string,
    userRole: string
  ): Promise<boolean> {
    // Configuración de seguridad por rol
    const SECURITY_CONFIG = {
      root: { probability: 0.2, everyN: 5 },
      gerente_general: { probability: 0.15, everyN: 10 },
      gerente_local: { probability: 0.1, everyN: 15 },
      vendedor: { probability: 0.08, everyN: 20 },
      cajero: { probability: 0.05, everyN: 30 }
    };

    const config = SECURITY_CONFIG[userRole] || {
      probability: 0.1,
      everyN: 20
    };

    // Generar número aleatorio entre 0 y 1
    const random = Math.random();
    const randomValidation = random <= config.probability;

    // Simular contador de requests (en producción usar Redis)
    const requestCount = Math.floor(Math.random() * 30) + 1; // Simulado
    const strategicValidation = requestCount % config.everyN === 0;

    const shouldValidate = randomValidation || strategicValidation;

    console.log(
      `🎲 Validation - User: ${userId}, Role: ${userRole}, Random: ${random.toFixed(3)}, ShouldValidate: ${shouldValidate}`
    );

    if (shouldValidate) {
      // Validación completa contra BD
      const assignment = await this.branchUserRepository.findOne({
        where: {
          user: { id: userId },
          branch: { id: branchId },
          isActive: true
        },
        relations: ['branch', 'user']
      });

      if (!assignment) {
        console.log(`❌ Access denied - User: ${userId}, Branch: ${branchId}`);
        return false;
      }

      console.log(
        `✅ Access granted - User: ${userId}, Branch: ${branchId}, Role: ${assignment.role}`
      );
      return true;
    }

    // Si no se valida, asumir válido
    console.log(`⚡ Skip validation - User: ${userId}, Branch: ${branchId}`);
    return true;
  }

  private async getUserPermissions(userRole: string): Promise<any> {
    const permissions = {
      root: {
        canViewAllBranches: true,
        canManageProducts: true,
        canManageUsers: true,
        canViewReports: true,
        canManageCash: true,
        canManageExpenses: true
      },
      gerente_general: {
        canViewAllBranches: true,
        canManageProducts: true,
        canManageUsers: true,
        canViewReports: true,
        canManageCash: true,
        canManageExpenses: true
      },
      gerente_local: {
        canViewAllBranches: false,
        canManageProducts: false,
        canManageUsers: false,
        canViewReports: true,
        canManageCash: true,
        canManageExpenses: false
      },
      vendedor: {
        canViewAllBranches: false,
        canManageProducts: false,
        canManageUsers: false,
        canViewReports: false,
        canManageCash: false,
        canManageExpenses: false
      },
      cajero: {
        canViewAllBranches: false,
        canManageProducts: false,
        canManageUsers: false,
        canViewReports: false,
        canManageCash: true,
        canManageExpenses: false
      }
    };

    return permissions[userRole] || permissions['vendedor'];
  }
}

// Extender Request interface
declare global {
  namespace Express {
    interface Request {
      currentBranch?: string;
      branchPermissions?: any;
    }
  }
}
