import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { getTeamMembers } from "@/lib/team/data"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { MembersTable } from "@/components/team/members-table"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Team" }

export default async function TeamPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // Membership is what a workspace is made of, so there is no team to show
  // before there is a workspace.
  if (!user.tenant_id) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Team"
          description="Who can work in this workspace, and what they can do."
        />
        <Panel title="No workspace yet">
          <div className="space-y-4 px-5 pb-5">
            <p className="text-sm text-muted-foreground">
              Create a workspace and you become its owner. You can invite people
              to it after that.
            </p>
            <Button nativeButton={false} render={<Link href="/workspace/new" />}>
              Create a workspace
            </Button>
          </div>
        </Panel>
      </div>
    )
  }

  const members = await getTeamMembers()

  return (
    <div className="grid gap-6 *:min-w-0">
      <PageHeader
        title="Team"
        description="Who can work in this workspace, and what they can do."
      />

      {!members.ok ? (
        <ServiceNotice message={members.error} />
      ) : (
        <Panel
          title="Members"
          description={`${members.data.length} ${
            members.data.length === 1 ? "person" : "people"
          } in this workspace`}
        >
          <MembersTable items={members.data} currentUserId={user.id} />
        </Panel>
      )}
    </div>
  )
}
