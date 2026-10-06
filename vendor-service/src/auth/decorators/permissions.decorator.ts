import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Permission names as auth-service's RBAC model spells them. */
export const Perm = {
  read: 'vendor.read',
  write: 'vendor.write',
  /** Receiving stock against a purchase order. */
  receive: 'vendor.receive',
  admin: 'vendor.admin',
} as const;
