/**
 * The platform's permission vocabulary.
 *
 * These strings are a contract with the other services: inventory-service,
 * vendor-service and transaction-service pass literals of their own to
 * `@Protected(...)`, and their PermissionsGuard tests them against the
 * `permissions` claim this service puts in the access token. A name that
 * exists here but not there is dead weight; a name used there but missing
 * here can never be granted, so the role silently cannot do the thing.
 * `npm run permissions:check` greps those services and fails on a mismatch.
 */
export interface PermissionDefinition {
  name: string;
  /** Groups the permission matrix in the UI. */
  resource: string;
  label: string;
  description: string;
}

export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
  // ── inventory-service ─────────────────────────────────────────────────────
  {
    name: 'inventory.read',
    resource: 'Inventory',
    label: 'View inventory',
    description: 'See products, variants, locations and stock levels.',
  },
  {
    name: 'inventory.write',
    resource: 'Inventory',
    label: 'Manage inventory',
    description: 'Create and edit products, variants, barcodes and locations.',
  },
  {
    name: 'inventory.adjust',
    resource: 'Inventory',
    label: 'Adjust stock',
    description: 'Move and correct stock levels, and record wastage.',
  },
  {
    name: 'inventory.admin',
    resource: 'Inventory',
    label: 'Administer inventory',
    description: 'Delete products and locations, and change variant types.',
  },

  // ── transaction-service ───────────────────────────────────────────────────
  {
    name: 'order.read',
    resource: 'Orders',
    label: 'View orders',
    description: 'See customer orders and their line items.',
  },
  {
    name: 'order.write',
    resource: 'Orders',
    label: 'Manage orders',
    description: 'Create and edit orders and customers.',
  },
  {
    name: 'order.fulfil',
    resource: 'Orders',
    label: 'Fulfil orders',
    description: 'Pick, pack and dispatch orders.',
  },
  {
    name: 'order.cancel',
    resource: 'Orders',
    label: 'Cancel orders',
    description: 'Cancel an order and release its stock.',
  },
  {
    name: 'order.admin',
    resource: 'Orders',
    label: 'Administer orders',
    description: 'Delete orders and override their status.',
  },

  // ── vendor-service ────────────────────────────────────────────────────────
  {
    name: 'vendor.read',
    resource: 'Purchasing',
    label: 'View suppliers',
    description: 'See suppliers and purchase orders.',
  },
  {
    name: 'vendor.write',
    resource: 'Purchasing',
    label: 'Manage purchasing',
    description: 'Create and edit suppliers and purchase orders.',
  },
  {
    name: 'vendor.receive',
    resource: 'Purchasing',
    label: 'Receive goods',
    description: 'Record deliveries against a purchase order.',
  },
  {
    name: 'vendor.admin',
    resource: 'Purchasing',
    label: 'Administer purchasing',
    description: 'Delete suppliers and purchase orders.',
  },

  // ── this service ──────────────────────────────────────────────────────────
  {
    name: 'team.read',
    resource: 'Team',
    label: 'View the team',
    description: 'See who is in the workspace and what role they hold.',
  },
  {
    name: 'team.invite',
    resource: 'Team',
    label: 'Invite people',
    description: 'Send, resend and revoke invitations.',
  },
  {
    name: 'team.manage',
    resource: 'Team',
    label: 'Manage the team',
    description: 'Change roles, remove members, and edit roles themselves.',
  },
  {
    name: 'workspace.manage',
    resource: 'Workspace',
    label: 'Manage the workspace',
    description: 'Rename the workspace and edit its business details.',
  },
  {
    name: 'reports.read',
    resource: 'Reports',
    label: 'View reports',
    description: 'See dashboards and exported reports.',
  },
] as const;

export const PERMISSION_NAMES: ReadonlySet<string> = new Set(
  PERMISSION_CATALOGUE.map((p) => p.name),
);

export function isKnownPermission(name: string): boolean {
  return PERMISSION_NAMES.has(name);
}

const ALL_PERMISSIONS = PERMISSION_CATALOGUE.map((p) => p.name);

export interface RolePreset {
  name: string;
  description: string;
  permissions: readonly string[];
  /** Nobody may edit this role's permissions, not even an owner. */
  locked?: boolean;
}

/**
 * Provisioned into every tenant. `owner` is locked: it is the role the
 * last-owner guard counts, and a workspace whose owner had been stripped of
 * `team.manage` could never be administered again.
 *
 * Renaming or deleting any of these is refused, because guards and
 * FULL_ACCESS_ROLES in the other services match on the role *name*.
 */
export const ROLE_PRESETS: readonly RolePreset[] = [
  {
    name: 'owner',
    description: 'Full access, including billing and the workspace itself.',
    permissions: ALL_PERMISSIONS,
    locked: true,
  },
  {
    name: 'admin',
    description: 'Full access to day-to-day operations and the team.',
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'manager',
    description: 'Runs stock, orders and purchasing; can see the team.',
    permissions: [
      'inventory.read',
      'inventory.write',
      'inventory.adjust',
      'order.read',
      'order.write',
      'order.fulfil',
      'order.cancel',
      'vendor.read',
      'vendor.write',
      'vendor.receive',
      'team.read',
      'reports.read',
    ],
  },
  {
    name: 'staff',
    description: 'Works the floor: picks and packs, reads stock.',
    permissions: [
      'inventory.read',
      'order.read',
      'order.write',
      'order.fulfil',
      'vendor.read',
    ],
  },
] as const;

export const OWNER_ROLE = 'owner';

export const SYSTEM_ROLE_NAMES: readonly string[] = ROLE_PRESETS.map(
  (r) => r.name,
);

export const LOCKED_ROLE_NAMES: readonly string[] = ROLE_PRESETS.filter(
  (r) => r.locked,
).map((r) => r.name);
