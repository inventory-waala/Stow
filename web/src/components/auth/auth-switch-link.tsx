"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/** Top-right link that flips between the two entry points. */
export function AuthSwitchLink() {
  const pathname = usePathname()
  const toSignup = pathname === "/login"

  return (
    <p className="text-sm text-muted-foreground">
      {toSignup ? "New here?" : "Have an account?"}{" "}
      <Link
        href={toSignup ? "/signup" : "/login"}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {toSignup ? "Create account" : "Log in"}
      </Link>
    </p>
  )
}
