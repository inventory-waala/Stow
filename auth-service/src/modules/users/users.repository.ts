import { Injectable } from '@nestjs/common';
import { UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateUserRepositoryDto,
  UserProfileDto,
} from '../../repositories/dto/user-repository.dto';
import { IUsersRepository } from '../../repositories/interfaces/users.repository.interface';

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
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        name: data.name,
        status: UserStatus.PENDING_VERIFICATION,
      },
      select: userProfileSelect,
    });

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user as unknown as UserProfileDto;
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
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId, tenant_id: tenantId },
    });

    if (userRoles.length === 0) {
      return { roles: [], permissions: [] };
    }

    const roleIds = userRoles.map((ur) => ur.role_id);

    const roles = await this.prisma.roles.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role_id: { in: roleIds } },
      select: { permission_id: true },
    });

    const permissionIds = rolePermissions.map((rp) => rp.permission_id);

    const permissions = await this.prisma.permissions.findMany({
      where: { id: { in: permissionIds } },
      select: { name: true },
    });

    return {
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.name),
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
