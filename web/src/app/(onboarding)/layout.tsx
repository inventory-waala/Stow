import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { logoutAction } from "@/lib/auth/actions"
import { Logo } from "@/components/brand/logo"

/**
 * Screens a signed-in user sees before — or instead of — the app itself.
 * Deliberately no sidebar: the proxy holds a workspace-less account here, and
 * a nav full of links that bounce straight back would only mislead. Signing
 * out stays reachable so nobody is trapped.
 */
export default async function OnboardingLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <Logo />
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign out
          </button>
        </form>
      </header>

      <main id="main" className="flex-1 px-6 pb-16 sm:px-10">
        {children}
      </main>
    </div>
  )
}
