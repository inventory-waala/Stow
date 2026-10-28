export interface TeamRole {
  id: string
  name: string
  description: string | null
  /** A preset role: it cannot be renamed or deleted. */
  is_system: boolean
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
