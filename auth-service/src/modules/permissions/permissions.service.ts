import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_CATALOGUE,
  PERMISSION_NAMES,
  PermissionDefinition,
  ROLE_PRESETS,
} from './permissions.catalogue';

/** Either the client or an open transaction, so callers can compose. */
export type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The catalogue is code, so the table is derived state: reconcile it on every
   * boot rather than relying on a seed script having been run against this
   * database.
   */
  async onModuleInit(): Promise<void> {
    await this.syncCatalogue();
  }

  listCatalogue(): readonly PermissionDefinition[] {
    return PERMISSION_CATALOGUE;
  }

  async syncCatalogue(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const permission of PERMISSION_CATALOGUE) {
        await tx.permissions.upsert({
          where: { name: permission.name },
          create: {
            name: permission.name,
            description: permission.description,
          },
          update: { description: permission.description },
        });
      }

      // Until now `POST /auth/roles/permissions` upserted whatever string it
      // was given, so a tenant admin could mint permission rows no service
      // has ever heard of. They can never grant anything, and leaving them
      // attached to a role makes the matrix UI lie about what a role can do.
      // RolePermission cascades, so the stale grants go with them.
      const unknown = await tx.permissions.findMany({
        where: { name: { notIn: [...PERMISSION_NAMES] } },
        select: { id: true, name: true },
      });
      if (unknown.length > 0) {
        await tx.permissions.deleteMany({
          where: { id: { in: unknown.map((p) => p.id) } },
        });
        this.logger.warn(
          `Removed ${unknown.length} permission(s) outside the catalogue: ${unknown
            .map((p) => p.name)
            .join(', ')}`,
        );
      }
    });
  }

  /**
   * Creates (or repairs) the preset roles for a tenant and gives each the
   * permissions its preset declares.
   *
   * Idempotent, and safe to call on an existing tenant: a preset's permission
   * set is reset to what the catalogue says, while custom roles and anyone's
   * role assignments are left alone.
   */
  async provisionTenantRoles(
    tenantId: string,
    client: PrismaLike = this.prisma,
  ): Promise<Record<string, string>> {
    const permissions = await client.permissions.findMany({
      select: { id: true, name: true },
    });
    const permissionIdByName = new Map(permissions.map((p) => [p.name, p.id]));

    const roleIdByName: Record<string, string> = {};

    for (const preset of ROLE_PRESETS) {
      const role = await client.roles.upsert({
        where: { name_tenant_id: { name: preset.name, tenant_id: tenantId } },
        create: {
          name: preset.name,
          tenant_id: tenantId,
          description: preset.description,
          is_system: true,
        },
        // A tenant created before presets existed has an `owner` role with
        // is_system false; mark it, but leave a hand-written description be.
        update: { is_system: true },
      });
      roleIdByName[preset.name] = role.id;

      const ids = preset.permissions
        .map((name) => permissionIdByName.get(name))
        .filter((id): id is string => !!id);

      await client.rolePermission.deleteMany({
        where: { role_id: role.id, permission_id: { notIn: ids } },
      });
      await client.rolePermission.createMany({
        data: ids.map((permission_id) => ({ role_id: role.id, permission_id })),
        skipDuplicates: true,
      });
    }

    return roleIdByName;
  }

  /**
   * Marks every access token issued for this tenant as out of date.
   *
   * Must be called from inside the same transaction as any write to UserRole,
   * Roles or RolePermission. Deliberately unconditional: deciding per write
   * whether anyone's claims actually changed is where a member keeps access
   * they should have lost. An unnecessary bump costs one token re-mint on
   * someone's next page load.
   */
  async bumpRbacVersion(
    tenantId: string,
    client: PrismaLike = this.prisma,
  ): Promise<number> {
    const tenant = await client.tenant.update({
      where: { id: tenantId },
      data: { rbac_version: { increment: 1 } },
      select: { rbac_version: true },
    });
    return tenant.rbac_version;
  }

  async getRbacVersion(tenantId: string): Promise<number | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { rbac_version: true },
    });
    return tenant?.rbac_version ?? null;
  }
}
