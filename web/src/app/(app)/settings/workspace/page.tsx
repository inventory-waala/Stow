import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser, getMyTenants } from "@/lib/auth/session"
import { SettingsSection } from "@/components/settings/section"
import { WorkspaceProfile } from "@/components/settings/workspace-profile"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Workspace" }

export default async function WorkspacePage() {
  const [user, tenants] = await Promise.all([getCurrentUser(), getMyTenants()])
  if (!user) redirect("/login")
  const tenant = tenants.find((t) => t.id === user.tenant_id)

  return (
    <SettingsSection
      title="Workspace"
      description="The company workspace you are currently working in."
    >
      {tenant ? (
        <WorkspaceProfile tenant={tenant} user={user} tenantCount={tenants.length} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are not in a workspace yet.
          </p>
          <Button nativeButton={false} render={<Link href="/workspace/new" />}>Create a workspace</Button>
        </div>
      )}
    </SettingsSection>
  )
}
