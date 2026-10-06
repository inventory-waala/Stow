import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { RolesGuard } from './guards/roles/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { IAuthController } from './interface/auth.controller.interface';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../tokens/interface/token.service.interface';
import { AUTH_SERVICE, IAuthService } from './interface/auth.service.interface';
import {
  IUsersService,
  USERS_SERVICE,
} from '../users/interfaces/users.service.interface';
import { PrismaService } from '../../prisma/prisma.service';

/** Roles permitted to administer roles and permissions within a tenant. */
const TENANT_ADMIN_ROLES = ['owner', 'admin'];

@Controller('auth')
export class AuthController implements IAuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    @Inject(TOKEN_SERVICE)
    private readonly tokensService: ITokenService,
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Role administration is always scoped to the tenant the caller is currently
   * authenticated into. Without this, any tenant admin could mutate roles in
   * any other tenant simply by passing a different tenant_id.
   */
  private assertSameTenant(req: any, tenantId: string): void {
    const callerTenant = req.user?.tenant_id;
    if (!callerTenant) {
      throw new ForbiddenException(
        'No tenant context on this token. Call /auth/switch-tenant first.',
      );
    }
    if (callerTenant !== tenantId) {
      throw new ForbiddenException(
        'Cannot administer roles outside your current tenant',
      );
    }
  }

  private async assertRoleInTenant(req: any, roleId: string): Promise<void> {
    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }
    this.assertSameTenant(req, role.tenant_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    // Read through to the database rather than trusting the (possibly stale)
    // JWT payload, but keep the tenant context the token was issued for.
    const profile = await this.usersService.getProfile(req.user.id);
    return {
      ...profile,
      tenant_id: req.user.tenant_id ?? null,
      roles: req.user.roles ?? [],
      permissions: req.user.permissions ?? [],
    };
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
      body.tenant_id,
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
  async verifyEmail(@Body('token') token: string): Promise<{ message: string }> {
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Post('roles')
  async createRole(@Request() req: any, @Body() body: CreateRoleDto) {
    this.assertSameTenant(req, body.tenant_id);
    return this.prisma.roles.create({
      data: {
        tenant_id: body.tenant_id,
        name: body.name,
        description: body.description,
      },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Post('roles/permissions')
  async assignPermissionsToRole(
    @Request() req: any,
    @Body() body: AssignPermissionsToRoleDto,
  ) {
    await this.assertRoleInTenant(req, body.role_id);

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Post('roles/assign')
  async assignRole(@Request() req: any, @Body() body: AssignRoleDto) {
    this.assertSameTenant(req, body.tenant_id);
    await this.assertRoleInTenant(req, body.role_id);

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Delete('roles/revoke')
  async revokeRole(@Request() req: any, @Body() body: RevokeRoleDto) {
    this.assertSameTenant(req, body.tenant_id);

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
