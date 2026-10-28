export interface TeamRoleDto {
  id: string;
  name: string;
  description: string | null;
  /** A preset role: it cannot be renamed or deleted. */
  is_system: boolean;
}

/** A role as the editor needs it: what it grants and who holds it. */
export interface TeamRoleDetailDto extends TeamRoleDto {
  /** Its permissions are fixed and cannot be edited by anyone. */
  locked: boolean;
  permissions: string[];
  member_count: number;
}

/** One entry in the permission vocabulary, for the matrix. */
export interface PermissionDto {
  name: string;
  resource: string;
  label: string;
  description: string;
}

export interface TeamMemberDto {
  user_id: string;
  name: string | null;
  email: string;
  status: string;
  is_email_verified: boolean;
  /** Every role this user holds in the workspace, in assignment order. */
  roles: TeamRoleDto[];
  /** When they first joined, i.e. their earliest role assignment. */
  joined_at: Date;
}

export interface TeamInviteDto {
  id: string;
  email: string;
  status: string;
  expires_at: Date;
  created_at: Date;
  role: TeamRoleDto;
}

/** What the accept screen can show before anyone has signed in. */
export interface InviteLookupDto {
  workspace: string;
  email: string;
  role: string;
  /** No account exists for this address yet, so accepting means registering. */
  needs_signup: boolean;
}
