export interface TeamRoleDto {
  id: string;
  name: string;
  description: string | null;
  /** A preset role: it cannot be renamed or deleted. */
  is_system: boolean;
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
