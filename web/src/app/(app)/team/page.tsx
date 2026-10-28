import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { getTeamInvites, getTeamMembers, getTeamRoles } from "@/lib/team/data"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { InviteSheet } from "@/components/team/invite-sheet"
import { InvitesTable } from "@/components/team/invites-table"
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

  // auth-service enforces all three; withholding the controls only avoids
  // offering actions that would come back 403.
  const canInvite = user.permissions.includes("team.invite")
  const canManage = user.permissions.includes("team.manage")

  const [members, roles, invites] = await Promise.all([
    getTeamMembers(),
    canManage || canInvite ? getTeamRoles() : Promise.resolve(null),
    canInvite ? getTeamInvites() : Promise.resolve(null),
  ])

  const roleList = roles?.ok ? roles.data : []

  return (
    <div className="grid gap-6 *:min-w-0">
      <PageHeader
        title="Team"
        description="Who can work in this workspace, and what they can do."
        action={
          canInvite && roleList.length ? <InviteSheet roles={roleList} /> : null
        }
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
          <MembersTable
            items={members.data}
            currentUserId={user.id}
            roles={roleList}
            canManage={canManage}
          />
        </Panel>
      )}

      {/* Only shown to someone who can act on them; an invitation nobody can
          resend or withdraw is just a list of email addresses. */}
      {canInvite && invites ? (
        invites.ok ? (
          invites.data.length ? (
            <Panel
              title="Pending invitations"
              description="Sent, not yet accepted"
            >
              <InvitesTable items={invites.data} canInvite={canInvite} />
            </Panel>
          ) : null
        ) : (
          <ServiceNotice message={invites.error} />
        )
      ) : null}
    </div>
  )
}
