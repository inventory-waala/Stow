import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/settings/section"
import { Switch } from "@/components/ui/switch"

export const metadata = { title: "Notifications" }

const PREFS = [
  { id: "low-stock", label: "Low stock alerts", description: "When an item drops below its reorder level." },
  { id: "orders", label: "Order updates", description: "New orders and status changes." },
  { id: "purchases", label: "Purchase approvals", description: "When a purchase needs your sign-off." },
  { id: "digest", label: "Weekly digest", description: "A summary of stock movement every Monday." },
]

// Preferences are not persisted yet; notification-service is not wired up.
export default function NotificationsPage() {
  return (
    <SettingsSection title="Notifications" description="What we email you about.">
      <SettingsGroup>
        {PREFS.map((pref) => (
          <SettingsRow key={pref.id} label={pref.label} hint={pref.description} htmlFor={pref.id}>
            <div className="flex sm:justify-end">
              <Switch id={pref.id} defaultChecked disabled />
            </div>
          </SettingsRow>
        ))}
      </SettingsGroup>
      <p className="text-xs text-muted-foreground">
        Preferences are shown as defaults; saving arrives with the notification service.
      </p>
    </SettingsSection>
  )
}
