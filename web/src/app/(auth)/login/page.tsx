import { LoginForm } from "@/components/auth/login-form"

export const metadata = { title: "Log in" }

const NOTICES: Record<string, string> = {
  verified: "Email verified. You can log in now.",
  reset: "Password updated. Log in with your new password.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = typeof params.next === "string" ? params.next : undefined
  const notice = Object.keys(NOTICES).find((key) => key in params)

  return <LoginForm next={next} notice={notice ? NOTICES[notice] : undefined} />
}
