import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Permission names as auth-service's RBAC model spells them. */
export const Perm = {
  read: 'inventory.read',
  write: 'inventory.write',
  adjust: 'inventory.adjust',
  admin: 'inventory.admin',
} as const;
