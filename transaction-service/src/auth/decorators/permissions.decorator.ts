import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Permission names as auth-service's RBAC model spells them. */
export const Perm = {
  read: 'order.read',
  /** Creating and editing orders and customers. */
  write: 'order.write',
  /** Confirming (reserving stock) and fulfilling (shipping it). */
  fulfil: 'order.fulfil',
  cancel: 'order.cancel',
  admin: 'order.admin',
} as const;
