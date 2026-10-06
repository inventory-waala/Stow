"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/**
 * Both icons are rendered and swapped with CSS so the server and client
 * markup match before next-themes has read the stored preference.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      className="rounded-full text-muted-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="size-4 dark:hidden" strokeWidth={1.75} />
      <MoonIcon className="hidden size-4 dark:block" strokeWidth={1.75} />
    </Button>
  )
}
