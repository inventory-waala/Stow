import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { getPermissionCatalogue, getTeamRoles } from "@/lib/team/data"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { RolesTable } from "@/components/team/roles-panel"
import { RoleSheet } from "@/components/team/role-sheet"

export const metadata = { title: "Roles" }

export default async function TeamRolesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (!user.tenant_id) redirect("/team")

  const canManage = user.permissions.includes("team.manage")
  const [roles, catalogue] = await Promise.all([
    getTeamRoles(),
    getPermissionCatalogue(),
  ])

  const permissions = catalogue.ok ? catalogue.data : []

  return (
    <div className="grid gap-6 *:min-w-0">
      <PageHeader
        title="Roles"
        description="What each role in this workspace can do."
        action={
          canManage && permissions.length ? (
            <RoleSheet catalogue={permissions} />
          ) : null
        }
      />

      {/* Without the catalogue there is nothing to tick, so the editor cannot
          open -- say so instead of quietly dropping the "New role" button and
          leaving it looking as though the workspace cannot have custom roles. */}
      {!catalogue.ok ? <ServiceNotice message={catalogue.error} /> : null}

      {!roles.ok ? (
        <ServiceNotice message={roles.error} />
      ) : (
        <Panel
          title="Roles"
          description="Built-in roles come with every workspace; add your own for anything else."
        >
          <RolesTable
            roles={roles.data}
            catalogue={permissions}
            canManage={canManage}
          />
        </Panel>
      )}
    </div>
  )
}
