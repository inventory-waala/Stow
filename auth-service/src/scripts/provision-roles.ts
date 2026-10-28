/**
 * Gives every existing tenant the preset roles and their permissions.
 *
 * New tenants get them at creation (TenantsService.provisionOwner), but
 * workspaces created before presets existed hold only an `owner` role with no
 * permission rows at all -- so `manager` and `staff` cannot be handed out, and
 * the only thing keeping owners working is the FULL_ACCESS_ROLES bypass in the
 * other services.
 *
 * Idempotent: preset permission sets are reset to what the catalogue says,
 * custom roles and everyone's role assignments are left alone. Each tenant's
 * rbac_version is bumped, because resetting a preset changes what its holders
 * can do and their tokens must re-mint.
 *
 * Run after `npm run prisma:migrate`:  npm run rbac:provision
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { buildConnectionConfig } from '../prisma/connection-config';
import { PermissionsService } from '../modules/permissions/permissions.service';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(buildConnectionConfig()),
  });
  // The service only needs the client; Nest is not involved here.
  const permissions = new PermissionsService(prisma as any);

  try {
    await permissions.syncCatalogue();
    console.log('permission catalogue synced');

    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { created_at: 'asc' },
    });

    for (const tenant of tenants) {
      await prisma.$transaction(async (tx) => {
        await permissions.provisionTenantRoles(tenant.id, tx);
        await permissions.bumpRbacVersion(tenant.id, tx);
      });
      console.log(`provisioned roles for ${tenant.name} (${tenant.id})`);
    }

    console.log(`\ndone: ${tenants.length} tenant(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
