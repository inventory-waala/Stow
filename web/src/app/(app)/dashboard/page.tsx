import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { AttentionList } from "@/components/dashboard/attention-list"
import { MovementChart } from "@/components/dashboard/movement-chart"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { Stats } from "@/components/dashboard/stats"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "Dashboard" }

function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

// Numbers here are placeholders until inventory/order services exist; see
// components/dashboard/data.ts.
export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const now = new Date()
  const firstName = user.name?.trim().split(/\s+/)[0]
  const hello = greeting(now.getHours())
  const date = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="grid gap-6 *:min-w-0">
      <PageHeader
        title={firstName ? `${hello}, ${firstName}` : hello}
        description={`${date} · Main warehouse`}
      />
      <Stats />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <MovementChart />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <AttentionList />
        </div>
      </div>
      <RecentOrders />
    </div>
  )
}
