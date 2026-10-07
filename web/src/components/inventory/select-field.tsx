"use client"

import { useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface SelectOption {
  value: string
  label: string
}

/**
 * Base UI treats an empty-string value as "nothing selected" and shows the
 * placeholder, but our forms use "" for real choices ("Untyped", "Top
 * level"). Those are mapped to this sentinel inside the popup and back to ""
 * on the way out, so the label renders and the form still posts "".
 */
const EMPTY = "__empty__"
const toInner = (v: string | undefined) => (v === undefined ? null : v === "" ? EMPTY : v)
const fromInner = (v: unknown) => (v === EMPTY || v == null ? "" : String(v))

/**
 * Form field built on the shadcn Select (`ui/select.tsx`). The popup is
 * rendered by the app, so it follows the theme instead of the OS. Submits
 * `name=value` through a hidden input, so server actions read it exactly
 * like a native control. Deliberately no `required`: Base UI would attach it
 * to an internal input the browser can't focus, silently blocking submit.
 * Required-ness is enforced by the API (JSON Schema) with a readable error.
 */
export function SelectField({
  id,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Choose…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  name?: string
  options: SelectOption[]
  /** Controlled value; "" selects the option with value "" if there is one. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const [inner, setInner] = useState<string>(defaultValue ?? "")
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const controlled = value !== undefined
  const current = controlled ? value : inner
  // Only show a label when the value matches an option; otherwise placeholder.
  const hasOption = options.some((o) => o.value === current)
  const items = useMemo(
    () => options.map((o) => ({ value: toInner(o.value) as string, label: o.label })),
    [options]
  )

  /**
   * Put the caret back on the trigger after a choice.
   *
   * The popup is portalled outside whatever dialog the field sits in, so when
   * it unmounts focus lands on document.body for an instant — long enough for
   * the dialog's focus trap to decide focus has escaped and recover it to the
   * first tabbable thing in the dialog. Which is somewhere near the title, not
   * the field you were filling in. Re-asserting on the next frame runs after
   * the trap and lands where a select is expected to leave you.
   */
  const keepFocus = () =>
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))

  return (
    <>
      {name ? <input type="hidden" name={name} value={hasOption ? current : ""} /> : null}
      <Select
        items={items}
        value={hasOption ? toInner(current) : null}
        onValueChange={(v) => {
          const next = fromInner(v)
          if (!controlled) setInner(next)
          onValueChange?.(next)
          keepFocus()
        }}
        disabled={disabled}
      >
        <SelectTrigger
          ref={triggerRef}
          id={id}
          aria-label={ariaLabel}
          className={cn("w-full", className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        {/* Drop below the trigger like a conventional select instead of
            overlaying it; the group adds the inner padding around items. */}
        <SelectContent alignItemWithTrigger={false} align="start" sideOffset={4}>
          <SelectGroup>
            {items.map((o) => (
              <SelectItem key={o.value} value={o.value} className="py-1.5">
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  )
}
