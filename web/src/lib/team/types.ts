export interface TeamRole {
  id: string
  name: string
  description: string | null
  /** A preset role: it cannot be renamed or deleted. */
  is_system: boolean
}

/**
 * A role as the editor needs it: what it grants and who holds it.
 *
 * The three fields below are optional because the services deploy
 * independently: an auth-service from before the role editor answers
 * /team/roles without them, and a page that assumed otherwise would crash
 * rather than degrade.
 */
export interface TeamRoleDetail extends TeamRole {
  /** Its permissions are fixed and cannot be edited by anyone (owner). */
  locked?: boolean
  permissions?: string[]
  member_count?: number
}

/** One entry in the permission vocabulary, for the matrix. */
export interface Permission {
  name: string
  /** Groups the matrix: "Inventory", "Orders", … */
  resource: string
  label: string
  description: string
}

export interface TeamInvite {
  id: string
  email: string
  status: string
  /** ISO timestamp; an invitation past it is dead but still listed. */
  expires_at: string
  created_at: string
  role: TeamRole
}

/** What the accept screen can show before anyone has signed in. */
export interface InviteLookup {
  workspace: string
  email: string
  role: string
  needs_signup: boolean
}

export interface TeamMember {
  user_id: string
  name: string | null
  email: string
  status: string
  is_email_verified: boolean
  roles: TeamRole[]
  /** ISO timestamp of their earliest role assignment in this workspace. */
  joined_at: string
}
