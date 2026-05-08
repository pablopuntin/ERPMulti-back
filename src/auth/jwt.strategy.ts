import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          // Primero intentar desde cookies
          if (request && request.cookies) {
            const token =
              request.cookies['access_token'] || request.cookies['token'];
            if (token) {
              return token;
            }
          }

          // Luego intentar desde headers
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            return token;
          }

          return null;
        }
      ]),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET env variable is not defined');
        return secret;
      })()
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      branchId: payload.branchId,
      activeBranchId: payload.activeBranchId || payload.branchId || null,
      allowedBranchIds: payload.allowedBranchIds || [],
      hasAllBranchAccess: payload.hasAllBranchAccess,
      canCreateUsers: payload.canCreateUsers,
      permissions: payload.permissions
    };
  }
}
