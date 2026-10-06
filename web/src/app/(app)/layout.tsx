import { redirect } from "next/navigation"

import { getCurrentUser, getMyTenants } from "@/lib/auth/session"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // proxy.ts guarantees a valid cookie here; a null user means auth-service
  // rejected the token (e.g. keys rotated), so fall back to a fresh login.
  const [user, tenants] = await Promise.all([getCurrentUser(), getMyTenants()])
  if (!user) redirect("/login")

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17rem",
          "--header-height": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={{ name: user.name ?? "", email: user.email }}
        tenants={tenants}
        activeTenantId={user.tenant_id}
      />
      <SidebarInset className="md:shadow-ambient md:border md:border-border/60">
        <SiteHeader />
        <div id="main" className="@container/main flex min-w-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
