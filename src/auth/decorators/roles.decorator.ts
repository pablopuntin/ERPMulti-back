import { SetMetadata } from '@nestjs/common';

// clave con la que guardamos los metadatos
export const ROLES_KEY = 'roles';

// decorador para aplicar roles
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
