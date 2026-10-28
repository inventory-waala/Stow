import { Injectable } from '@nestjs/common';
import { UserStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserRepositoryDto,
  UserProfileDto,
} from './dto/user-repository.dto';
import {
  IUsersRepository,
  TenantRbacContext,
} from './interfaces/users.repository.interface';

const userProfileSelect = {
  id: true,
  email: true,
  password: true,
  name: true,
  status: true,
  is_email_verified: true,
  created_at: true,
  updated_at: true,
} as const;

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async newUser(data: CreateUserRepositoryDto): Promise<UserProfileDto> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        name: data.name,
        status: UserStatus.PENDING_VERIFICATION,
      },
      select: userProfileSelect,
    }) as unknown as Promise<UserProfileDto>;
  }

  /** Used to roll back a half-finished registration. */
  async deleteUser(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findProfileById(id: string): Promise<UserProfileDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userProfileSelect,
    });
    return user as unknown as UserProfileDto | null;
  }

  async verifyUserEmail(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        is_email_verified: true,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async updatePassword(id: string, hash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: hash },
    });
  }

  async findUserRolesAndPermissions(
    userId: string,
    tenantId: string,
  ): Promise<TenantRbacContext> {
    // Read the version first: a bump that lands while the roles below are
    // being read would otherwise produce a token stamped with the newer
    // version but carrying the older claims -- stale, and no longer detectable.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { rbac_version: true },
    });
    const rbac_version = tenant?.rbac_version ?? 0;

    // One hop now that UserRole has relations: the role and its permission
    // names come back with the membership rows.
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      select: {
        role: {
          select: {
            name: true,
            permissions: { select: { permission: { select: { name: true } } } },
          },
        },
      },
    });

    if (userRoles.length === 0) {
      return { roles: [], permissions: [], rbac_version };
    }

    const permissions = new Set<string>();
    for (const { role } of userRoles) {
      for (const rp of role.permissions) permissions.add(rp.permission.name);
    }

    return {
      roles: userRoles.map((ur) => ur.role.name),
      permissions: [...permissions],
      rbac_version,
    };
  }

  async findFirstUserRole(
    userId: string,
  ): Promise<{ tenant_id: string } | null> {
    return this.prisma.userRole.findFirst({
      where: { user_id: userId },
      select: { tenant_id: true },
    });
  }
}
