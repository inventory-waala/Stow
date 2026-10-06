import { Logo } from "@/components/brand/logo"
import { AuthPanel } from "@/components/auth/auth-panel"
import { AuthSwitchLink } from "@/components/auth/auth-switch-link"

/**
 * Split auth layout shared by login, signup and the email-link screens.
 * The brand panel is decorative and hidden below lg; the form column owns
 * the focus.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <AuthPanel />

      <div className="relative flex flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo className="lg:invisible" />
          <AuthSwitchLink />
        </header>

        <main id="main" className="flex flex-1 items-center px-6 pb-16 sm:px-10">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </main>
      </div>
    </div>
  )
}
