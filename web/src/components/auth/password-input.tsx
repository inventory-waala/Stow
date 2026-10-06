"use client"

import { useState } from "react"
import { EyeClosedIcon, EyeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Password field with the show/hide toggle from the previous login form. */
export function PasswordInput(
  props: Omit<React.ComponentProps<typeof Input>, "type">
) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-0 h-full -translate-y-1/2 px-3 text-muted-foreground hover:bg-transparent"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? (
          <EyeIcon className="h-4 w-4" />
        ) : (
          <EyeClosedIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
