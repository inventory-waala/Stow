import { TeamSubNav } from "@/components/team/sub-nav"

export default function TeamLayout({ children }: LayoutProps<"/team">) {
  return (
    <div className="grid gap-6">
      <TeamSubNav />
      {children}
    </div>
  )
}
