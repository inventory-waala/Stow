import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/settings/section"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export const metadata = { title: "Profile" }

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <SettingsSection title="Profile" description="How you appear to the rest of your team.">
      {/* Read-only until auth-service exposes a profile-update endpoint. */}
      <SettingsGroup>
        <SettingsRow label="Name" htmlFor="name">
          <Input id="name" value={user.name ?? ""} readOnly className="max-w-sm" />
        </SettingsRow>
        <SettingsRow label="Email" htmlFor="email" hint="Used to log in and for notifications">
          <div className="flex max-w-sm items-center gap-3">
            <Input id="email" value={user.email} readOnly className="flex-1" />
            <Badge
              variant="outline"
              className={
                user.is_email_verified
                  ? "rounded-md border-transparent bg-brand-soft text-brand"
                  : "rounded-md"
              }
            >
              {user.is_email_verified ? "Verified" : "Unverified"}
            </Badge>
          </div>
        </SettingsRow>
        <SettingsRow label="Status">
          <Badge variant="secondary" className="rounded-md font-mono text-xs">
            {user.status}
          </Badge>
        </SettingsRow>
      </SettingsGroup>
      <p className="text-xs text-muted-foreground">
        Name and email cannot be changed yet. Write to help@stow.app if something is wrong.
      </p>
    </SettingsSection>
  )
}
