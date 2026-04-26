import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class UserMiddleware {
  constructor(private readonly usersService: UsersService) {}

  async use(req: any, res: any, next: any) {
    try {
      // Extraer el userId del JWT payload
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return next();
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));

      // Obtener el usuario completo desde la base de datos
      const user = await this.usersService.findOne(payload.sub);

      if (user) {
        // Agregar el usuario completo al request
        req.user = {
          ...user,
          roles: payload.roles || []
        };

        console.log('🟢 [UserMiddleware] Usuario agregado al request:', {
          id: user.id,
          name: user.firstname,
          roles: payload.roles
        });
      }
    } catch (error) {
      console.error('❌ [UserMiddleware] Error al procesar usuario:', error);
    }

    next();
  }
}
