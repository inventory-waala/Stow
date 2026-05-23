import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  CreateRoleDto,
  AssignPermissionsToRoleDto,
  AssignRoleDto,
  RevokeRoleDto,
} from './dto/auth.controller.dto';
import { SwitchTenantDto } from '../tenants/dto/tenants.controller.dto';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { IAuthController } from './interface/auth.controller.interface';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../tokens/interface/token.service.interface';
import { JwtService } from '@nestjs/jwt';
import { AUTH_SERVICE, IAuthService } from './interface/auth.service.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController implements IAuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    @Inject(TOKEN_SERVICE)
    private readonly tokensService: ITokenService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @Post('login')
  async login(@Body() loginData: LoginDto): Promise<LoginResponseDto> {
    const tokens = await this.authService.login(loginData);
    return tokens;
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto): Promise<LoginResponseDto> {
    const tokens = await this.authService.refreshToken(
      body.user_id,
      body.token,
    );
    return tokens;
  }

  @Post('logout')
  async logout(@Body() body: RefreshTokenDto): Promise<{ message: string }> {
    const validationResult = await this.tokensService.validateRefreshToken(
      body.user_id,
      body.token,
    );

    if (validationResult.isValid) {
      await this.tokensService.revokeRefreshToken(body.token);
    }

    return { message: 'Successfully logged out' };
  }

  @Post('verify-email')
  async verifyEmail(
    @Body('token') token: string,
  ): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<{ message: string; resetToken?: string }> {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-tenant')
  async switchTenant(
    @Request() req: any,
    @Body() body: SwitchTenantDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.switchTenant(req.user.id, body.tenant_id);
  }

  // ── Admin: Role Management ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('roles')
  async createRole(@Body() body: CreateRoleDto) {
    return this.prisma.roles.create({
      data: {
        tenant_id: body.tenant_id,
        name: body.name,
        description: body.description,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('roles/permissions')
  async assignPermissionsToRole(@Body() body: AssignPermissionsToRoleDto) {
    // Upsert each permission then link to role
    const results = await Promise.all(
      body.permissions.map(async (permName) => {
        const permission = await this.prisma.permissions.upsert({
          where: { name: permName },
          create: { name: permName },
          update: {},
        });
        return this.prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: body.role_id,
              permission_id: permission.id,
            },
          },
          create: { role_id: body.role_id, permission_id: permission.id },
          update: {},
        });
      }),
    );
    return { assigned: results.length };
  }

  @UseGuards(JwtAuthGuard)
  @Post('roles/assign')
  async assignRole(@Body() body: AssignRoleDto) {
    return this.prisma.userRole.upsert({
      where: {
        user_id_role_id_tenant_id: {
          user_id: body.user_id,
          role_id: body.role_id,
          tenant_id: body.tenant_id,
        },
      },
      create: {
        user_id: body.user_id,
        role_id: body.role_id,
        tenant_id: body.tenant_id,
      },
      update: {},
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('roles/revoke')
  async revokeRole(@Body() body: RevokeRoleDto) {
    await this.prisma.userRole.deleteMany({
      where: {
        user_id: body.user_id,
        role_id: body.role_id,
        tenant_id: body.tenant_id,
      },
    });
    return { message: 'Role revoked successfully' };
  }
}
