"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { refreshRbacAction } from "@/lib/auth/actions"

/**
 * Re-mints the session when auth-service reports the token's RBAC claims are
 * out of date -- someone changed this user's role, or edited the role itself.
 *
 * The access token carries roles and permissions, so a change made by another
 * admin would otherwise sit unseen until the token expired. `GET /auth/me`,
 * which the app shell already calls on every navigation, reports the staleness.
 *
 * Fires once per mounted session: router.refresh() keeps client state, so the
 * ref survives the re-render and a change we cannot apply (the membership is
 * gone) can't turn into a refresh loop.
 */
export function RbacRefresh({ stale }: { stale: boolean }) {
  const router = useRouter()
  const attempted = useRef(false)

  useEffect(() => {
    if (!stale || attempted.current) return
    attempted.current = true
    void refreshRbacAction().then(() => router.refresh())
  }, [stale, router])

  return null
}
