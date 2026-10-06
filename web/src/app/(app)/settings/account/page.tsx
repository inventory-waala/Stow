import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { PasskeyRegister } from "@/components/settings/passkey-register"
import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/settings/section"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Account" }

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <SettingsSection title="Account" description="How you sign in.">
      <PasskeyRegister />

      <SettingsGroup>
        <SettingsRow label="Password" hint={`A reset link goes to ${user.email}`}>
          <Button
            variant="outline"
            className="rounded-full"
            nativeButton={false}
            render={<Link href="/forgot-password" />}
          >
            Change password
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  )
}
