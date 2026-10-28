-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- AlterTable
ALTER TABLE "Roles" ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "rbac_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_tenant_id_status_idx" ON "Invitation"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tenant_id_email_key" ON "Invitation"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "UserRole_tenant_id_idx" ON "UserRole"("tenant_id");

-- Orphan cleanup. Roles, RolePermission and UserRole have carried no foreign
-- keys until now, so rows pointing at deleted users, roles or tenants may
-- exist; the constraints below would refuse to be created while they do.
-- Roles first, so UserRole rows orphaned by that deletion are caught too.
DELETE FROM "Roles" r
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = r."tenant_id");

DELETE FROM "RolePermission" rp
WHERE NOT EXISTS (SELECT 1 FROM "Roles" r WHERE r."id" = rp."role_id")
   OR NOT EXISTS (SELECT 1 FROM "Permissions" p WHERE p."id" = rp."permission_id");

DELETE FROM "UserRole" ur
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = ur."user_id")
   OR NOT EXISTS (SELECT 1 FROM "Roles" r WHERE r."id" = ur."role_id")
   OR NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = ur."tenant_id");

-- AddForeignKey
ALTER TABLE "Roles" ADD CONSTRAINT "Roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The tenant's existing `owner` role is a preset provisioned by the service,
-- not something a user created, so it must be protected like the other presets.
UPDATE "Roles" SET "is_system" = true WHERE "name" IN ('owner', 'admin', 'manager', 'staff');
