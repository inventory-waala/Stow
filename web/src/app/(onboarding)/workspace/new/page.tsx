import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { WorkspaceForm } from "@/components/settings/workspace-form"

export const metadata = { title: "New workspace" }

export default async function NewWorkspacePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // Already in a workspace: this is the "add another" case, so leaving is an
  // option. Without one it is the required first step.
  return <WorkspaceForm canCancel={!!user.tenant_id} />
}
