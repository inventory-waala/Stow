"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { authApi } from "@/lib/auth/auth-service"
import { getSession, setSessionCookies } from "@/lib/auth/session"
import { describeError, teamApi } from "./data"

export type TeamActionState =
  | { error?: string; field?: string; success?: string }
  | undefined

async function token(): Promise<string> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session.accessToken
}

function fail(err: unknown): TeamActionState {
  return { error: describeError(err) }
}

/**
 * The member list, and the sidebar's workspace switcher in the layout above
 * it, both move when membership changes.
 */
function revalidateTeam() {
  revalidatePath("/team")
  revalidatePath("/team/roles")
  revalidatePath("/", "layout")
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email address"),
  role_id: z.string().min(1, "Choose a role"),
})

export async function inviteMemberAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    role_id: String(formData.get("role_id") ?? ""),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue.message, field: String(issue.path[0] ?? "") }
  }

  try {
    await teamApi.invite(await token(), parsed.data)
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: `Invitation sent to ${parsed.data.email}` }
}

export async function resendInviteAction(
  id: string
): Promise<TeamActionState> {
  try {
    await teamApi.resendInvite(await token(), id)
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: "Invitation sent again" }
}

export async function revokeInviteAction(
  id: string
): Promise<TeamActionState> {
  try {
    await teamApi.revokeInvite(await token(), id)
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: "Invitation withdrawn" }
}

export async function changeMemberRoleAction(
  userId: string,
  roleId: string
): Promise<TeamActionState> {
  try {
    await teamApi.changeRole(await token(), userId, roleId)
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: "Role updated" }
}

export async function removeMemberAction(
  userId: string
): Promise<TeamActionState> {
  try {
    await teamApi.removeMember(await token(), userId)
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: "Removed from the workspace" }
}

/**
 * Leaving takes the current workspace off the token, so the session has to be
 * re-minted into one the user still belongs to -- otherwise every page keeps
 * acting on a workspace they just left until the token expires.
 */
export async function leaveWorkspaceAction(): Promise<TeamActionState> {
  try {
    const accessToken = await token()
    await teamApi.leave(accessToken)

    const remaining = await authApi.myTenants(accessToken)
    if (remaining.length > 0) {
      const next = await authApi.switchTenant(accessToken, remaining[0].id)
      await setSessionCookies({ accessToken: next.accessToken })
    }
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  // With no workspace left the proxy holds them at workspace creation, which
  // is the same place a fresh account lands.
  redirect("/dashboard")
}

/**
 * Creates or edits a role.
 *
 * Identity and permissions are separate routes on the service -- a preset's
 * name is fixed while its permissions are not -- so the caller sends only the
 * parts it means to change, and a preset never gets a rename it would refuse.
 */
export async function saveRoleAction(input: {
  id?: string
  name?: string
  description?: string
  permissions?: string[]
}): Promise<TeamActionState> {
  try {
    const accessToken = await token()

    if (!input.id) {
      if (!input.name?.trim()) return { error: "Name the role", field: "name" }
      await teamApi.createRole(accessToken, {
        name: input.name,
        description: input.description,
        permissions: input.permissions ?? [],
      })
    } else {
      if (input.name !== undefined || input.description !== undefined) {
        await teamApi.updateRole(accessToken, input.id, {
          name: input.name,
          description: input.description,
        })
      }
      if (input.permissions !== undefined) {
        await teamApi.setRolePermissions(
          accessToken,
          input.id,
          input.permissions
        )
      }
    }
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: input.id ? "Role saved" : "Role created" }
}

export async function deleteRoleAction(id: string): Promise<TeamActionState> {
  try {
    await teamApi.deleteRole(await token(), id)
  } catch (err) {
    return fail(err)
  }
  revalidateTeam()
  return { success: "Role deleted" }
}

/** Accepts an invitation as the signed-in user and switches into it. */
export async function acceptInviteAction(
  inviteToken: string
): Promise<TeamActionState> {
  let tenantId: string
  try {
    const accessToken = await token()
    const result = await teamApi.acceptInvite(accessToken, inviteToken)
    tenantId = result.tenant_id

    // Join and then stand in it: the workspace they were invited to is the
    // one they expect to be looking at.
    const next = await authApi.switchTenant(accessToken, tenantId)
    await setSessionCookies({ accessToken: next.accessToken })
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/", "layout")
  redirect("/dashboard")
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(64, "Use at most 64 characters"),
})

/** Accepts an invitation by creating the account it was sent to. */
export async function acceptInviteWithRegistrationAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const inviteToken = String(formData.get("token") ?? "")
  if (!inviteToken) return { error: "This link is missing its token" }

  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue.message, field: String(issue.path[0] ?? "") }
  }

  try {
    await teamApi.acceptInviteWithRegistration({
      token: inviteToken,
      ...parsed.data,
    })
  } catch (err) {
    return fail(err)
  }
  // The account exists and is verified, but has no session: send them through
  // the normal sign-in rather than minting one from a registration response.
  redirect("/login?invited=1")
}
