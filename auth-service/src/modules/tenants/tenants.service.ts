import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OWNER_ROLE } from '../permissions/permissions.catalogue';
import {
  PermissionsService,
  type PrismaLike,
} from '../permissions/permissions.service';
import {
  CreateTenantDto,
  TenantProfileDto,
  UpdateTenantDto,
} from './dto/tenants.dto';

/** rbac_version is an internal signal; it never leaves on a tenant payload. */
const tenantProfileSelect = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  updated_at: true,
} as const;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Creates a tenant and makes the caller its owner.
   *
   * Membership lives in user_roles, so a tenant created without an owner row
   * would be unreachable — nobody could administer it or switch into it.
   */
  async create(
    userId: string,
    data: CreateTenantDto,
  ): Promise<TenantProfileDto> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          description: data.description,
        },
        select: tenantProfileSelect,
      });

      await this.provisionOwner(tenant.id, userId, tx);

      return tenant;
    });
  }

  /**
   * Renames or re-describes a tenant the caller already belongs to.
   *
   * `tenantId` comes from the caller's token, never the body, so there is no
   * way to edit a workspace you are not currently in. Membership is still
   * re-checked against user_roles: a token outlives a revoked role.
   */
  async update(
    userId: string,
    tenantId: string,
    data: UpdateTenantDto,
  ): Promise<TenantProfileDto> {
    const membership = await this.prisma.userRole.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
      select: { tenant_id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const patch: UpdateTenantDto = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.description !== undefined) {
      patch.description = data.description.trim();
    }
    if (patch.name === '') {
      throw new BadRequestException('Workspace name cannot be empty');
    }

    try {
      return await this.prisma.tenant.update({
        where: { id: tenantId },
        data: patch,
        select: tenantProfileSelect,
      });
    } catch (error: any) {
      // Tenant.name is uniquely indexed (see the init migration).
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Another workspace already uses that name.',
        );
      }
      if (error?.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async findUserTenants(userId: string): Promise<TenantProfileDto[]> {
    // Get all unique tenant IDs for this user via user_roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      select: { tenant_id: true },
      distinct: ['tenant_id'],
    });

    if (userRoles.length === 0) return [];

    const tenantIds = userRoles.map((ur) => ur.tenant_id);

    return this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: tenantProfileSelect,
    });
  }

  // Used internally during registration to bootstrap a tenant
  async createWithOwnerRole(
    userId: string,
    tenantName: string,
  ): Promise<string> {
    const tenant = await this.createWithUniqueName(tenantName);

    // The retry loop above cannot run inside a transaction -- a unique
    // violation aborts the whole thing in Postgres -- so provisioning is a
    // second transaction rather than one.
    await this.prisma.$transaction((tx) =>
      this.provisionOwner(tenant.id, userId, tx),
    );

    return tenant.id;
  }

  /**
   * Tenant.name carries a unique index (see the init migration), but the name
   * auto-derived at registration comes from the user's display name, so two
   * people called "Test User" would collide and the second signup would fail.
   * Try the plain name first so the common case stays readable, then fall back
   * to a suffixed variant.
   */
  private async createWithUniqueName(base: string) {
    const trimmed = base.trim() || 'Workspace';

    for (let attempt = 0; attempt < 6; attempt++) {
      const name =
        attempt === 0
          ? trimmed
          : `${trimmed} (${randomBytes(3).toString('hex')})`;
      try {
        return await this.prisma.tenant.create({ data: { name } });
      } catch (error: any) {
        const isDuplicateName =
          error?.code === 'P2002' &&
          String(error?.meta?.target ?? error?.meta?.constraint ?? '').includes(
            'name',
          );
        if (!isDuplicateName) throw error;
      }
    }

    throw new ConflictException(
      'Could not allocate a unique tenant name; please try again.',
    );
  }

  /**
   * Gives the tenant its preset roles (owner, admin, manager, staff) and makes
   * the given user its owner.
   *
   * No rbac_version bump: a tenant this new has no other members, so there is
   * no token out there to invalidate. Any path that re-provisions an existing
   * tenant must bump, because resetting a preset's permissions changes what
   * every holder of that role can do.
   */
  private async provisionOwner(
    tenantId: string,
    userId: string,
    client: PrismaLike = this.prisma,
  ): Promise<void> {
    const roleIdByName = await this.permissions.provisionTenantRoles(
      tenantId,
      client,
    );
    const ownerRoleId = roleIdByName[OWNER_ROLE];

    await client.userRole.upsert({
      where: {
        user_id_role_id_tenant_id: {
          user_id: userId,
          role_id: ownerRoleId,
          tenant_id: tenantId,
        },
      },
      create: {
        user_id: userId,
        role_id: ownerRoleId,
        tenant_id: tenantId,
      },
      update: {},
    });
  }
}
