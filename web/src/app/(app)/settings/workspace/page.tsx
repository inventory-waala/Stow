import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser, getMyTenants } from "@/lib/auth/session"
import { SettingsSection } from "@/components/settings/section"
import { WorkspaceDetailsForm } from "@/components/settings/workspace-details-form"
import { WorkspaceProfile } from "@/components/settings/workspace-profile"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Workspace" }

export default async function WorkspacePage() {
  const [user, tenants] = await Promise.all([getCurrentUser(), getMyTenants()])
  if (!user) redirect("/login")
  const tenant = tenants.find((t) => t.id === user.tenant_id)
  // Mirrors TENANT_ADMIN_ROLES in auth-service's tenants controller.
  const canEdit = user.roles.some((r) => r === "owner" || r === "admin")

  return (
    <SettingsSection
      title="Workspace"
      description="The company workspace you are currently working in."
    >
      {tenant ? (
        <>
          <WorkspaceProfile tenant={tenant} user={user} tenantCount={tenants.length} />
          {/* The server enforces this too; hiding the form from everyone else
              just avoids offering an action that would come back 403. */}
          {canEdit ? (
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-ambient sm:p-6">
              <div className="mb-5">
                <h4 className="text-sm font-medium">Edit details</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Only owners and admins can change these.
                </p>
              </div>
              <WorkspaceDetailsForm tenant={tenant} />
            </div>
          ) : null}
        </>
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
