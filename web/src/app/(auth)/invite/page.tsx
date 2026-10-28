import Link from "next/link"

import { getSession } from "@/lib/auth/session"
import { describeError, teamApi } from "@/lib/team/data"
import type { InviteLookup } from "@/lib/team/types"
import {
  AcceptInviteButton,
  AcceptInviteForm,
} from "@/components/team/accept-invite"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Invitation" }

function Dead({ message }: { message: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          This invitation can&apos;t be used
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button
        variant="outline"
        className="rounded-full"
        nativeButton={false}
        render={<Link href="/login" />}
      >
        Go to sign in
      </Button>
    </div>
  )
}

export default async function InvitePage({
  searchParams,
}: PageProps<"/invite">) {
  const { token } = await searchParams
  const inviteToken = typeof token === "string" ? token : ""
  if (!inviteToken) {
    return <Dead message="This link is missing its token. Ask for a new one." />
  }

  let invite: InviteLookup
  try {
    invite = await teamApi.lookupInvite(inviteToken)
  } catch (err) {
    return <Dead message={describeError(err)} />
  }

  const session = await getSession()

  const heading = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Join {invite.workspace}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You were invited as{" "}
        <span className="font-medium text-foreground capitalize">
          {invite.role}
        </span>{" "}
        at {invite.email}.
      </p>
    </div>
  )

  // No account at that address yet, so accepting and registering are the same
  // step. The token proves the address, so there is no verification email.
  if (invite.needs_signup) {
    return (
      <div className="space-y-6">
        {heading}
        <AcceptInviteForm token={inviteToken} email={invite.email} />
      </div>
    )
  }

  // An account exists. Accepting has to happen as *that* account, which the
  // server re-checks -- signing in as someone else would add the wrong person.
  if (!session) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="text-sm text-muted-foreground">
          You already have an account. Sign in to accept.
        </p>
        <Button
          className="w-full rounded-full"
          nativeButton={false}
          render={
            <Link
              href={`/login?next=${encodeURIComponent(`/invite?token=${inviteToken}`)}`}
            />
          }
        >
          Sign in to accept
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {heading}
      {session.claims.email.toLowerCase() === invite.email.toLowerCase() ? (
        <AcceptInviteButton token={inviteToken} />
      ) : (
        <p className="text-sm text-muted-foreground">
          You are signed in as{" "}
          <span className="font-medium text-foreground">
            {session.claims.email}
          </span>
          . This invitation was sent to {invite.email} — sign in as that account
          to accept it.
        </p>
      )}
    </div>
  )
}
