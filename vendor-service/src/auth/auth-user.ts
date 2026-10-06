/** Claims auth-service embeds in an access token (see its auth.service.ts). */
export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  tenant_id?: string;
  roles?: string[];
  permissions?: string[];
}

/** Roles that bypass per-permission checks (auth-service seeds no permission rows yet). */
export const FULL_ACCESS_ROLES = ['owner', 'admin'];
