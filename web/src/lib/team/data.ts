import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"

import { authRequest, AuthServiceError } from "@/lib/auth/auth-service"
import { getSession } from "@/lib/auth/session"
import type { Loaded } from "@/lib/service-client"
import type {
  InviteLookup,
  Permission,
  TeamInvite,
  TeamMember,
  TeamRoleDetail,
} from "./types"

/** Team lives on auth-service: membership *is* a role assignment there. */
export const teamApi = {
  members: (accessToken: string) =>
    authRequest<TeamMember[]>("/team/members", { accessToken }),

  roles: (accessToken: string) =>
    authRequest<TeamRoleDetail[]>("/team/roles", { accessToken }),

  permissions: (accessToken: string) =>
    authRequest<Permission[]>("/team/permissions", { accessToken }),

  createRole: (
    accessToken: string,
    body: { name: string; description?: string; permissions?: string[] }
  ) =>
    authRequest<TeamRoleDetail>("/team/roles", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken,
    }),

  updateRole: (
    accessToken: string,
    id: string,
    body: { name?: string; description?: string }
  ) =>
    authRequest<TeamRoleDetail>(`/team/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      accessToken,
    }),

  setRolePermissions: (
    accessToken: string,
    id: string,
    permissions: string[]
  ) =>
    authRequest<TeamRoleDetail>(`/team/roles/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
      accessToken,
    }),

  deleteRole: (accessToken: string, id: string) =>
    authRequest<{ message: string }>(`/team/roles/${id}`, {
      method: "DELETE",
      accessToken,
    }),

  invites: (accessToken: string) =>
    authRequest<TeamInvite[]>("/team/invites", { accessToken }),

  invite: (accessToken: string, body: { email: string; role_id: string }) =>
    authRequest<{ invite: TeamInvite; token?: string }>("/team/invites", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken,
    }),

  resendInvite: (accessToken: string, id: string) =>
    authRequest<{ invite: TeamInvite; token?: string }>(
      `/team/invites/${id}/resend`,
      { method: "POST", accessToken }
    ),

  revokeInvite: (accessToken: string, id: string) =>
    authRequest<{ message: string }>(`/team/invites/${id}`, {
      method: "DELETE",
      accessToken,
    }),

  changeRole: (accessToken: string, userId: string, role_id: string) =>
    authRequest<{ message: string }>(`/team/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role_id }),
      accessToken,
    }),

  removeMember: (accessToken: string, userId: string) =>
    authRequest<{ message: string }>(`/team/members/${userId}`, {
      method: "DELETE",
      accessToken,
    }),

  leave: (accessToken: string) =>
    authRequest<{ message: string }>("/team/leave", {
      method: "POST",
      accessToken,
    }),

  // ── Accepting. These are the only team calls made without a session, so
  //    they take no token: the invitation token is the credential.
  lookupInvite: (token: string) =>
    authRequest<InviteLookup>(
      `/team/invites/lookup?token=${encodeURIComponent(token)}`
    ),

  acceptInvite: (accessToken: string, token: string) =>
    authRequest<{ tenant_id: string }>("/team/invites/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
      accessToken,
    }),

  acceptInviteWithRegistration: (body: {
    token: string
    name: string
    password: string
  }) =>
    authRequest<{ user_id: string; tenant_id: string }>(
      "/team/invites/accept/register",
      { method: "POST", body: JSON.stringify(body) }
    ),
}

export function describeError(err: unknown): string {
  if (err instanceof AuthServiceError) {
    if (err.status === 403) {
      return "Your workspace role doesn't allow you to see the team. Ask an owner or admin."
    }
    return err.message
  }
  if (err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message)) {
    return "Auth service is unreachable. Is it running on port 3001?"
  }
  return err instanceof Error ? err.message : "Something went wrong"
}

async function load<T>(fn: (token: string) => Promise<T>): Promise<Loaded<T>> {
  const session = await getSession()
  if (!session) redirect("/login")
  try {
    return { ok: true, data: await fn(session.accessToken) }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

export const getTeamMembers = cache(() => load((t) => teamApi.members(t)))
export const getTeamRoles = cache(() => load((t) => teamApi.roles(t)))
export const getTeamInvites = cache(() => load((t) => teamApi.invites(t)))
export const getPermissionCatalogue = cache(() =>
  load((t) => teamApi.permissions(t))
)
