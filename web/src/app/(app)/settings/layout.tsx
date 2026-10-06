import { PageHeader } from "@/components/layout/page-header"
import { SidebarNav } from "@/components/settings/sidebar-nav"

export const metadata = { title: "Settings" }

const items = [
  { title: "Profile", href: "/settings/profile" },
  { title: "Account", href: "/settings/account" },
  { title: "Workspace", href: "/settings/workspace" },
  { title: "Notifications", href: "/settings/notifications" },
]

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Settings"
        description="Your account, the workspace you are in, and what we tell you about."
      />
      <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <SidebarNav items={items} />
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  )
}
