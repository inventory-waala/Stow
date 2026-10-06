import Link from "next/link"

import { cn } from "@/lib/utils"

export const BRAND = "Stow"

/**
 * The Stow mark: an open box with its lid lifted, drawn as two strokes and
 * one dot for whatever is inside. Inherits `currentColor`.
 */
export function StowMark({
  className,
  strokeWidth = 2,
}: {
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* box body */}
      <path d="M4 11.5h16v6a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
      {/* lid, hinged at the left, lifted on the right */}
      <path d="M4 11.5 5.8 4.6 20 8" />
      {/* the thing being stowed */}
      <circle cx="12" cy="15.75" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Wordmark used across the landing page and auth screens. */
export function Logo({
  className,
  href = "/",
  light = false,
}: {
  className?: string
  href?: string
  /** Force white text (dark panels). */
  light?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={`${BRAND} home`}
      className={cn("flex items-center gap-2.5 rounded-full", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
        <StowMark className="size-5" />
      </span>
      <span
        className={cn(
          "text-lg font-semibold tracking-[-0.03em]",
          light ? "text-white" : "text-foreground"
        )}
      >
        {BRAND}
      </span>
    </Link>
  )
}
