import {
  Body,
  Controller,
  ConflictException,
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
import { PermissionsService } from '../permissions/permissions.service';
import {
  isKnownPermission,
  LOCKED_ROLE_NAMES,
  OWNER_ROLE,
} from '../permissions/permissions.catalogue';

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
    private readonly permissions: PermissionsService,
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

  private async assertRoleInTenant(req: any, roleId: string) {
    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }
    this.assertSameTenant(req, role.tenant_id);
    return role;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    // Read through to the database rather than trusting the (possibly stale)
    // JWT payload, but keep the tenant context the token was issued for.
    const profile = await this.usersService.getProfile(req.user.id);
    const tenantId = req.user.tenant_id ?? null;
    return {
      ...profile,
      tenant_id: tenantId,
      roles: req.user.roles ?? [],
      permissions: req.user.permissions ?? [],
      rbac_stale: await this.isRbacStale(tenantId, req.user.rbac_v),
    };
  }

  /**
   * True when the tenant's roles or permissions have been written since this
   * token was signed, so the holder's `roles`/`permissions` claims no longer
   * match the database.
   *
   * Lives on this endpoint because the app shell already calls it on every
   * navigation: staleness rides along with a request that was happening
   * anyway, and the guards stay free of database calls (docs/plan.md phase
   * 8.5). The client's answer is to re-mint via POST /auth/switch-tenant.
   */
  private async isRbacStale(
    tenantId: string | null,
    tokenVersion: unknown,
  ): Promise<boolean> {
    if (!tenantId) return false;
    const current = await this.permissions.getRbacVersion(tenantId);
    // Tenant gone: there is nothing to re-mint into, and saying "stale" would
    // put the client in a refresh loop.
    if (current === null) return false;
    // Tokens signed before rbac_v existed carry no version, which counts as
    // stale -- they re-mint once and then match.
    return current !== tokenVersion;
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.roles.create({
          data: {
            tenant_id: body.tenant_id,
            name: body.name,
            description: body.description,
          },
        });
        await this.permissions.bumpRbacVersion(body.tenant_id, tx);
        return role;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'A role with that name already exists in this workspace.',
        );
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Post('roles/permissions')
  async assignPermissionsToRole(
    @Request() req: any,
    @Body() body: AssignPermissionsToRoleDto,
  ) {
    const role = await this.assertRoleInTenant(req, body.role_id);

    if (LOCKED_ROLE_NAMES.includes(role.name)) {
      throw new ForbiddenException(
        `The ${role.name} role's permissions cannot be changed.`,
      );
    }

    // Only names the catalogue knows. This used to upsert whatever string it
    // was given, which let a tenant admin mint permission rows no service
    // checks -- unusable, and the role then read as holding powers that do
    // not exist.
    const unknown = body.permissions.filter((name) => !isKnownPermission(name));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permission(s): ${unknown.join(', ')}`,
      );
    }

    const permissions = await this.prisma.permissions.findMany({
      where: { name: { in: body.permissions } },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          role_id: body.role_id,
          permission_id: p.id,
        })),
        skipDuplicates: true,
      });
      await this.permissions.bumpRbacVersion(role.tenant_id, tx);
      return { assigned: permissions.length };
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Post('roles/assign')
  async assignRole(@Request() req: any, @Body() body: AssignRoleDto) {
    this.assertSameTenant(req, body.tenant_id);
    await this.assertRoleInTenant(req, body.role_id);

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userRole.upsert({
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
      await this.permissions.bumpRbacVersion(body.tenant_id, tx);
      return assignment;
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Delete('roles/revoke')
  async revokeRole(@Request() req: any, @Body() body: RevokeRoleDto) {
    this.assertSameTenant(req, body.tenant_id);
    await this.assertNotLastOwner(body.tenant_id, body.role_id, body.user_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          user_id: body.user_id,
          role_id: body.role_id,
          tenant_id: body.tenant_id,
        },
      });
      await this.permissions.bumpRbacVersion(body.tenant_id, tx);
    });
    return { message: 'Role revoked successfully' };
  }

  /**
   * A workspace with no owner can never be administered again: owner is the
   * one role that cannot be stripped of team.manage, so losing the last one
   * is unrecoverable without database access.
   */
  private async assertNotLastOwner(
    tenantId: string,
    roleId: string,
    userId: string,
  ): Promise<void> {
    const role = await this.prisma.roles.findUnique({
      where: { id: roleId },
      select: { name: true },
    });
    if (role?.name !== OWNER_ROLE) return;

    const holder = await this.prisma.userRole.findUnique({
      where: {
        user_id_role_id_tenant_id: {
          user_id: userId,
          role_id: roleId,
          tenant_id: tenantId,
        },
      },
      select: { user_id: true },
    });
    if (!holder) return;

    const owners = await this.prisma.userRole.count({
      where: { tenant_id: tenantId, role_id: roleId },
    });
    if (owners <= 1) {
      throw new BadRequestException(
        "This is the workspace's last owner. Make someone else an owner first.",
      );
    }
  }
}
