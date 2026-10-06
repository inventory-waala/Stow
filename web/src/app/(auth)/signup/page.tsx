import { SignupForm } from "@/components/auth/signup-form"

export const metadata = { title: "Create your account" }

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // The landing-page CTA hands these over as query params.
  const params = await searchParams
  const email = typeof params.email === "string" ? params.email : ""
  const name = typeof params.name === "string" ? params.name : ""

  return <SignupForm initialEmail={email} initialName={name} />
}
