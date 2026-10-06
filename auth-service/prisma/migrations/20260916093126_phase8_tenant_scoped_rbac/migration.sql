-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'INACTIVE';

-- DropIndex
DROP INDEX "Roles_name_key";

-- DropIndex
DROP INDEX "Tenant_name_key";

-- AlterTable
ALTER TABLE "Permissions" DROP COLUMN "name",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role_id", "permission_id");

-- DropIndex
DROP INDEX "RolePermission_role_id_permission_id_key";

-- AlterTable
ALTER TABLE "Roles" ADD COLUMN     "tenant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("user_id", "role_id", "tenant_id");

-- DropIndex
DROP INDEX "UserRole_user_id_role_id_tenant_id_key";

-- DropEnum
DROP TYPE "PermissionNames";

-- CreateIndex
CREATE UNIQUE INDEX "Permissions_name_key" ON "Permissions"("name");

-- CreateIndex
CREATE INDEX "Roles_tenant_id_idx" ON "Roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_name_tenant_id_key" ON "Roles"("name", "tenant_id");

