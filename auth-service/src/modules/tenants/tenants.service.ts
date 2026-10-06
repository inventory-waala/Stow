import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, TenantProfileDto } from './dto/tenants.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });

    await this.provisionOwner(tenant.id, userId);

    return tenant;
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
    });
  }

  // Used internally during registration to bootstrap a tenant
  async createWithOwnerRole(
    userId: string,
    tenantName: string,
  ): Promise<string> {
    const tenant = await this.createWithUniqueName(tenantName);

    await this.provisionOwner(tenant.id, userId);

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

  /** Upserts the tenant's `owner` role and assigns it to the given user. */
  private async provisionOwner(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const ownerRole = await this.prisma.roles.upsert({
      where: { name_tenant_id: { name: 'owner', tenant_id: tenantId } },
      create: {
        name: 'owner',
        tenant_id: tenantId,
        description: 'Full access role',
      },
      update: {},
    });

    await this.prisma.userRole.upsert({
      where: {
        user_id_role_id_tenant_id: {
          user_id: userId,
          role_id: ownerRole.id,
          tenant_id: tenantId,
        },
      },
      create: {
        user_id: userId,
        role_id: ownerRole.id,
        tenant_id: tenantId,
      },
      update: {},
    });
  }
}
