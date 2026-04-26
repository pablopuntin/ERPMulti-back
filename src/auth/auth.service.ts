//refactor
import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

type AuthScope = {
  role: string;
  permissions: string[];
  canCreateUsers: string[];
  hasAllBranchAccess: boolean;
  allowedBranchIds: string[];
  activeBranchId: string | null;
};

const normalizeRole = (roleName?: string | null) => {
  switch (roleName) {
    case 'root':
      return 'root';
    case 'superadmin':
      return 'root';
    case 'owner':
      return 'gerente_general';
    case 'gerente_general':
      return 'gerente_general';
    case 'manager':
      return 'gerente_sucursal';
    case 'gerente_local':
      return 'gerente_sucursal';
    case 'gerente_sucursal':
      return 'gerente_sucursal';
    case 'seller':
      return 'vendedor';
    case 'vendedor':
      return 'vendedor';
    case 'cashier':
      return 'cajero';
    case 'cajero':
      return 'cajero';
    default:
      return roleName || 'cajero';
  }
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstname, lastname } = registerDto;

    if (!firstname || !lastname)
      throw new BadRequestException('El nombre del usuario es requerido');

    // crear usuario con rol por defecto
    await this.usersService.create({
      ...registerDto,
      password
    });

    return { message: 'Usuario registrado con éxito' };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) throw new BadRequestException('Email o Password inválido');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      throw new BadRequestException('Email o Password inválido');

    const scope = this.buildAuthScope(user);
    return this.buildAuthResponse(user, scope);
  }

  async switchBranch(userId: string, branchId: string) {
    const user = await this.usersService.findOneWithAccessProfile(userId);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const scope = this.buildAuthScope(user, branchId);

    if (
      !scope.hasAllBranchAccess &&
      !scope.allowedBranchIds.includes(branchId)
    ) {
      throw new BadRequestException(
        'No tienes acceso a la sucursal solicitada'
      );
    }

    return this.buildAuthResponse(user, scope);
  }

  private buildAuthScope(
    user: any,
    requestedBranchId?: string | null
  ): AuthScope {
    const role = normalizeRole(user.roles?.[0]?.name);
    const activeAssignments = (user.branchAssignments || []).filter(
      (assignment: any) => assignment?.isActive && assignment?.branch?.id
    );
    const allowedBranchIds = activeAssignments.map(
      (assignment: any) => assignment.branch.id
    );
    const hasExplicitGlobalBranchAccess = activeAssignments.some(
      (assignment: any) => assignment?.permissions?.canViewAllBranches === true
    );

    let permissions: string[] = [];
    let canCreateUsers: string[] = [];
    let hasAllBranchAccess = false;

    switch (role) {
      case 'root':
        hasAllBranchAccess = true;
        canCreateUsers = [
          'gerente_general',
          'gerente_sucursal',
          'vendedor',
          'cajero'
        ];
        permissions = [
          'manage_all',
          'manage_users',
          'assign_roles',
          'assign_branches',
          'view_all_reports',
          'manage_products',
          'manage_branch',
          'operate_branch'
        ];
        break;
      case 'gerente_general':
        hasAllBranchAccess = hasExplicitGlobalBranchAccess;
        canCreateUsers = ['gerente_sucursal', 'vendedor', 'cajero'];
        permissions = [
          'manage_users',
          'assign_branch_staff',
          'view_all_reports_assigned',
          'manage_products',
          'manage_branch',
          'operate_branch'
        ];
        break;
      case 'gerente_sucursal':
        canCreateUsers = ['vendedor', 'cajero'];
        permissions = [
          'create_branch_users',
          'view_branch_reports',
          'manage_products',
          'manage_branch',
          'operate_branch'
        ];
        break;
      case 'cajero':
        permissions = [
          'operate_branch',
          'manage_cash',
          'view_sales',
          'view_stock'
        ];
        break;
      case 'vendedor':
        permissions = [
          'operate_branch',
          'manage_sales',
          'manage_products',
          'view_stock'
        ];
        break;
      default:
        permissions = ['view_only'];
    }

    const preferredAssignment = activeAssignments.find(
      (assignment: any) => assignment?.branch?.type === 'branch'
    );
    const fallbackBranchId =
      preferredAssignment?.branch?.id || allowedBranchIds[0] || null;
    const activeBranchId = requestedBranchId ?? fallbackBranchId;

    if (!hasAllBranchAccess && !activeBranchId) {
      throw new BadRequestException(
        'El usuario no tiene una sucursal activa asignada'
      );
    }

    if (
      !hasAllBranchAccess &&
      activeBranchId &&
      !allowedBranchIds.includes(activeBranchId)
    ) {
      throw new BadRequestException(
        'La sucursal activa no está asignada al usuario'
      );
    }

    return {
      role,
      permissions,
      canCreateUsers,
      hasAllBranchAccess,
      allowedBranchIds,
      activeBranchId
    };
  }

  private buildAuthResponse(user: any, scope: AuthScope) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.firstname,
      role: scope.role,
      branchId: scope.activeBranchId,
      activeBranchId: scope.activeBranchId,
      allowedBranchIds: scope.allowedBranchIds,
      hasAllBranchAccess: scope.hasAllBranchAccess,
      canCreateUsers: scope.canCreateUsers,
      permissions: scope.permissions
    };

    return {
      access_token: this.jwtService.sign(payload),
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.firstname,
        role: scope.role,
        branchId: scope.activeBranchId,
        activeBranchId: scope.activeBranchId,
        allowedBranchIds: scope.allowedBranchIds,
        hasAllBranchAccess: scope.hasAllBranchAccess,
        canCreateUsers: scope.canCreateUsers,
        permissions: scope.permissions
      }
    };
  }
}
