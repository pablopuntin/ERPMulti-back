import { Controller, Body, Post, Req, UseGuards } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthSwagger } from './decorators/auth-swagger.decorator';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('root')
  @Post('register')
  @ApiOperation({ summary: 'registro de usuarios' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'inicio de sesión' })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @AuthSwagger()
  @UseGuards(AuthGuard('jwt'))
  @Post('switch-branch')
  @ApiOperation({ summary: 'cambiar sucursal activa del usuario autenticado' })
  async switchBranch(@Req() req: Request, @Body('branchId') branchId: string) {
    return this.authService.switchBranch((req.user as any).userId, branchId);
  }
}
