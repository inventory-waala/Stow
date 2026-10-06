"use client"

import { useState, useTransition } from "react"
import { startRegistration } from "@simplewebauthn/browser"
import { CheckIcon, FingerprintIcon } from "lucide-react"

import {
  passkeyRegisterAction,
  passkeyRegisterOptionsAction,
} from "@/lib/auth/actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Status = "idle" | "loading" | "success" | "error"

export function PasskeyRegister() {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [, startTransition] = useTransition()

  function register() {
    setStatus("loading")
    setMessage("")
    startTransition(async () => {
      const { options, error } = await passkeyRegisterOptionsAction()
      if (!options) {
        setStatus("error")
        setMessage(error ?? "Could not start registration")
        return
      }
      let attestation
      try {
        attestation = await startRegistration({ optionsJSON: options as never })
      } catch (err) {
        setStatus("error")
        setMessage(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Registration was cancelled."
            : "Your device could not create a passkey."
        )
        return
      }
      const result = await passkeyRegisterAction(attestation)
      if (result?.error) {
        setStatus("error")
        setMessage(result.error)
      } else {
        setStatus("success")
        setMessage(result?.success ?? "Passkey added.")
      }
    })
  }

  const loading = status === "loading"

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-secondary/50 p-1.5">
      <div className="flex flex-col gap-5 rounded-[1.125rem] bg-card p-5 sm:flex-row sm:items-center">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand",
            loading && "animate-pulse"
          )}
        >
          {status === "success" ? (
            <CheckIcon className="size-5" strokeWidth={2} />
          ) : (
            <FingerprintIcon className="size-5" strokeWidth={1.5} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Passkey</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? "Follow the prompt on your device."
              : "Sign in with Touch ID, Windows Hello or your phone instead of a password."}
          </p>
        </div>
        <Button
          onClick={register}
          disabled={loading}
          variant={status === "success" ? "outline" : "default"}
          className="shrink-0 rounded-full"
        >
          {loading ? "Waiting..." : status === "success" ? "Add another" : "Add a passkey"}
        </Button>
      </div>

      {status === "success" || status === "error" ? (
        <p
          role="status"
          className={cn(
            "px-4 py-2.5 text-sm",
            status === "success" ? "text-brand" : "text-destructive"
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
