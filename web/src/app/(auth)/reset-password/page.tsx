import { ResetPasswordForm } from "@/components/auth/simple-forms"

export const metadata = { title: "Choose a new password" }

export default async function Page({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams
  return <ResetPasswordForm token={typeof token === "string" ? token : undefined} />
}
