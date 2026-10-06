import { VerifyEmailForm } from "@/components/auth/simple-forms"

export const metadata = { title: "Verify email" }

export default async function Page({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams
  return <VerifyEmailForm token={typeof token === "string" ? token : undefined} />
}
