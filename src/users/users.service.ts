import {
  Injectable,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { CreateUserDto, UserRoleName } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Branch } from 'src/branches/entities/branch.entity';
import {
  BranchUser,
  BranchUserRole
} from 'src/branches/entities/branch-user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(BranchUser)
    private readonly branchUserRepository: Repository<BranchUser>
  ) {}

  private readonly manageableRoles = new Set<string>([
    UserRoleName.ROOT,
    UserRoleName.GERENTE_GENERAL,
    UserRoleName.GERENTE_SUCURSAL,
    UserRoleName.VENDEDOR,
    UserRoleName.CAJERO
  ]);

  private hasRole(user: any, role: string) {
    if (user?.role && typeof user.role === 'string') {
      return user.role === role;
    }

    return user?.roles?.some((r: any) =>
      typeof r === 'string' ? r === role : r.name === role
    );
  }

  private validateCreatorScope(
    currentUser: any,
    createUserDto: CreateUserDto,
    resolvedRoleName: string
  ) {
    if (!currentUser) {
      return;
    }

    const creatorRole = currentUser?.role;
    const creatorAllowedRoles = Array.isArray(currentUser?.canCreateUsers)
      ? currentUser.canCreateUsers
      : [];

    if (!creatorRole || !creatorAllowedRoles.includes(resolvedRoleName)) {
      throw new BadRequestException(
        'No tienes permisos para crear usuarios con ese rol'
      );
    }

    if (
      createUserDto.globalBranchAccess === true &&
      !currentUser?.hasAllBranchAccess
    ) {
      throw new BadRequestException(
        'No tienes permisos para otorgar acceso global a sucursales'
      );
    }

    const requestedBranchIds = Array.from(
      new Set(createUserDto.branchIds || [])
    );
    if (currentUser?.hasAllBranchAccess) {
      return;
    }

    const allowedBranchIds = Array.isArray(currentUser?.allowedBranchIds)
      ? currentUser.allowedBranchIds
      : [];

    if (
      requestedBranchIds.some(
        (branchId) => !allowedBranchIds.includes(branchId)
      )
    ) {
      throw new BadRequestException(
        'No puedes asignar sucursales fuera de tu alcance'
      );
    }

    if (
      creatorRole === UserRoleName.GERENTE_SUCURSAL &&
      requestedBranchIds.length === 0
    ) {
      throw new BadRequestException(
        'Debes asignar al menos una sucursal dentro de tu alcance'
      );
    }
  }

  private mapUserRoleToBranchRole(roleName: string): BranchUserRole | null {
    switch (roleName) {
      case UserRoleName.GERENTE_GENERAL:
        return BranchUserRole.GENERAL_MANAGER;
      case UserRoleName.GERENTE_SUCURSAL:
        return BranchUserRole.MANAGER;
      case UserRoleName.VENDEDOR:
        return BranchUserRole.EMPLOYEE;
      case UserRoleName.CAJERO:
        return BranchUserRole.CASHIER;
      default:
        return null;
    }
  }

  private sanitizeUser(user: any) {
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      roles: Array.isArray(user?.roles)
        ? user.roles.map((role: any) => role.name)
        : [],
      branchAssignments: Array.isArray(user?.branchAssignments)
        ? user.branchAssignments.map((assignment: any) => ({
            id: assignment.id,
            branchId: assignment.branch?.id,
            branchName: assignment.branch?.name,
            role: assignment.role,
            permissions: assignment.permissions,
            isActive: assignment.isActive
          }))
        : []
    };
  }

  private async assignBranchesToUser(
    user: User,
    createUserDto: CreateUserDto,
    resolvedRoleName: string
  ) {
    const branchRole = this.mapUserRoleToBranchRole(resolvedRoleName);
    if (!branchRole) {
      return;
    }

    const requestedBranchIds = Array.from(
      new Set(createUserDto.branchIds || [])
    );
    const globalBranchAccess = createUserDto.globalBranchAccess === true;

    if (!globalBranchAccess && requestedBranchIds.length === 0) {
      throw new BadRequestException(
        'Debe asignarse al menos una sucursal al usuario'
      );
    }

    const assignments: BranchUser[] = [];

    if (requestedBranchIds.length > 0) {
      const branches = await this.branchRepository.find({
        where: requestedBranchIds.map((id) => ({ id, isActive: true }))
      });

      if (branches.length !== requestedBranchIds.length) {
        throw new BadRequestException(
          'Una o más sucursales asignadas no existen o están inactivas'
        );
      }

      for (const branch of branches) {
        assignments.push(
          this.branchUserRepository.create({
            user,
            branch,
            role: branchRole,
            isActive: true,
            permissions: {
              canViewAllBranches: globalBranchAccess,
              canManageUsers:
                resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
                resolvedRoleName === UserRoleName.GERENTE_SUCURSAL,
              canManageProducts:
                resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
                resolvedRoleName === UserRoleName.GERENTE_SUCURSAL ||
                resolvedRoleName === UserRoleName.VENDEDOR,
              canViewReports:
                resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
                resolvedRoleName === UserRoleName.GERENTE_SUCURSAL,
              canManageCash:
                resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
                resolvedRoleName === UserRoleName.GERENTE_SUCURSAL ||
                resolvedRoleName === UserRoleName.CAJERO,
              canManageExpenses:
                resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
                resolvedRoleName === UserRoleName.GERENTE_SUCURSAL
            }
          })
        );
      }
    } else if (globalBranchAccess) {
      const anchorBranch = await this.branchRepository.findOne({
        where: { isActive: true }
      });

      if (!anchorBranch) {
        throw new BadRequestException(
          'No hay sucursales activas disponibles para otorgar acceso global'
        );
      }

      assignments.push(
        this.branchUserRepository.create({
          user,
          branch: anchorBranch,
          role: branchRole,
          isActive: true,
          permissions: {
            canViewAllBranches: true,
            canManageUsers:
              resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
              resolvedRoleName === UserRoleName.GERENTE_SUCURSAL,
            canManageProducts:
              resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
              resolvedRoleName === UserRoleName.GERENTE_SUCURSAL ||
              resolvedRoleName === UserRoleName.VENDEDOR,
            canViewReports:
              resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
              resolvedRoleName === UserRoleName.GERENTE_SUCURSAL,
            canManageCash:
              resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
              resolvedRoleName === UserRoleName.GERENTE_SUCURSAL ||
              resolvedRoleName === UserRoleName.CAJERO,
            canManageExpenses:
              resolvedRoleName === UserRoleName.GERENTE_GENERAL ||
              resolvedRoleName === UserRoleName.GERENTE_SUCURSAL
          }
        })
      );
    }

    if (assignments.length > 0) {
      await this.branchUserRepository.save(assignments);
    }
  }

  async create(createUserDto: CreateUserDto, currentUser?: any) {
    const { email, password, firstname, lastname, role, roleName } =
      createUserDto;

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new BadRequestException('Email already exists');

    const resolvedRoleName = roleName || role?.name || 'cajero';
    if (!this.manageableRoles.has(resolvedRoleName)) {
      throw new BadRequestException(
        `Role "${resolvedRoleName}" is not allowed`
      );
    }

    this.validateCreatorScope(currentUser, createUserDto, resolvedRoleName);

    const assignedRole = await this.roleRepository.findOne({
      where: { name: resolvedRoleName }
    });
    if (!assignedRole)
      throw new BadRequestException(`Role "${resolvedRoleName}" not found`);

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const user = this.userRepository.create({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      roles: [assignedRole]
    });

    const saved = await this.userRepository.save(user);

    await this.assignBranchesToUser(saved, createUserDto, resolvedRoleName);

    const createdUser = await this.findOne(saved.id);

    return createdUser;
  }

  // async findByEmail(email: string) {
  //   return this.userRepository.findOne({ where: { email } });
  // }

  //refactor@@
  async findByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
      relations: ['roles', 'branchAssignments', 'branchAssignments.branch']
    });
  }

  async findOneWithAccessProfile(id: string) {
    return this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'branchAssignments', 'branchAssignments.branch']
    });
  }

  async findAll(page: number, limit: number) {
    //Parseo page y limit porque llegan com string del front
    const skip = (page - 1) * limit;
    const users = await this.userRepository.find({
      relations: ['roles', 'branchAssignments', 'branchAssignments.branch'],

      //take y skip son propiedades de BD
      take: limit,
      skip: skip
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'branchAssignments', 'branchAssignments.branch']
    });

    if (!user) {
      throw new NotFoundException(`No existe usuario con id ${id}`);
    }

    return this.sanitizeUser(user);
  }

  async update(id: string, updateUserDto: any) {
    await this.userRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string, currentUser: any) {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: false,
      relations: ['roles']
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const currentUserId = currentUser?.userId || currentUser?.id;
    const isSelf = currentUserId === user.id;

    // Roles del usuario a eliminar
    const targetIsRoot = this.hasRole(user, 'root');
    const targetIsGeneralManager = this.hasRole(user, 'gerente_general');

    // Roles del usuario logueado
    const currentIsRoot = this.hasRole(currentUser, 'root');
    const currentIsGeneralManager = this.hasRole(
      currentUser,
      'gerente_general'
    );

    // 🚫 1. Nadie puede eliminar a un root
    if (targetIsRoot) {
      throw new BadRequestException('Root users cannot be deleted');
    }

    // ✔️ 2. Root puede eliminar a cualquiera (menos root)
    if (currentIsRoot) {
      await this.userRepository.update(id, { isActive: false });
      await this.userRepository.softDelete(id);
      return { message: 'User deleted by root', id };
    }

    // ✔️ 3. Un usuario puede eliminarse a sí mismo
    if (isSelf) {
      await this.userRepository.softDelete(id);
      return { message: 'User deleted itself', id };
    }

    // ✔️ 4. Gerente general puede eliminar usuarios que no sean root ni gerente general
    if (currentIsGeneralManager && !targetIsGeneralManager) {
      await this.userRepository.softDelete(id);
      return { message: 'User deleted by gerente_general', id };
    }

    // ❌ 5. Todo lo demás prohibido
    throw new BadRequestException('Not allowed to delete this user');
  }

  async makeAdmin(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles']
    });

    if (!user) {
      throw new NotFoundException(`No existe usuario con id ${id}`);
    }

    // Compatibilidad temporal: promover a gerente_general
    const adminRole = await this.roleRepository.findOne({
      where: { name: 'gerente_general' }
    });

    if (!adminRole) {
      throw new BadRequestException(
        'No existe el rol "gerente_general" en la base de datos. Debe crearse primero.'
      );
    }

    // Verificar si ya tiene ese rol
    const alreadyAdmin = user.roles.some((r) => r.name === 'gerente_general');
    if (alreadyAdmin) {
      throw new BadRequestException(
        'El usuario ya tiene el rol de gerente general.'
      );
    }

    // Agregar el rol gerente_general
    user.roles = [adminRole];
    const updatedUser = await this.userRepository.save(user);

    // Remover password antes de devolver
    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  //hasta aca funcionaba bien-cambiar pass de admin
  async resetPasswordAsSuperadmin(
    targetUserId: string,
    newPassword: string,
    currentUser: any
  ) {
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['roles']
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentIsRoot = this.hasRole(currentUser, 'root');
    if (!currentIsRoot) {
      throw new BadRequestException('Only root can reset passwords');
    }

    // Hash del nuevo password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(user.id, { password: hashedPassword });

    return { message: 'Password reset successfully', id: user.id };
  }
}
