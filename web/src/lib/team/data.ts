import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"

import { authRequest, AuthServiceError } from "@/lib/auth/auth-service"
import { getSession } from "@/lib/auth/session"
import type { Loaded } from "@/lib/service-client"
import type { TeamMember, TeamRole } from "./types"

/** Team lives on auth-service: membership *is* a role assignment there. */
export const teamApi = {
  members: (accessToken: string) =>
    authRequest<TeamMember[]>("/team/members", { accessToken }),

  roles: (accessToken: string) =>
    authRequest<TeamRole[]>("/team/roles", { accessToken }),
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
