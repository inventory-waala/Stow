import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, TenantProfileDto } from './dto/tenants.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTenantDto): Promise<TenantProfileDto> {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
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
    // 1. Create the tenant
    const tenant = await this.prisma.tenant.create({
      data: { name: tenantName },
    });

    // 2. Upsert the 'owner' role for this tenant
    const ownerRole = await this.prisma.roles.upsert({
      where: { name_tenant_id: { name: 'owner', tenant_id: tenant.id } },
      create: {
        name: 'owner',
        tenant_id: tenant.id,
        description: 'Full access role',
      },
      update: {},
    });

    // 3. Assign user to owner role in this tenant
    await this.prisma.userRole.create({
      data: {
        user_id: userId,
        role_id: ownerRole.id,
        tenant_id: tenant.id,
      },
    });

    return tenant.id;
  }
}
