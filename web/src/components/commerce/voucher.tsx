"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * One thing you can do to the document you are entering.
 *
 * `keys` is written the way it is pressed — "mod+s", "alt+n", "?" — where
 * `mod` is Ctrl, or Cmd on a Mac.
 */
export interface VoucherAction {
  keys: string
  label: string
  /** One line on what it does, shown in the help overlay. */
  hint?: string
  run: () => void
  disabled?: boolean
  primary?: boolean
  /** Bound to the keyboard but kept off the rail. */
  hidden?: boolean
}

const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

/** "mod+s" → "⌘S" on a Mac, "Ctrl S" elsewhere. */
export function prettyKeys(keys: string): string {
  const mac = isMac()
  return keys
    .split("+")
    .map((part) => {
      const p = part.trim().toLowerCase()
      if (p === "mod") return mac ? "⌘" : "Ctrl"
      if (p === "alt") return mac ? "⌥" : "Alt"
      if (p === "shift") return mac ? "⇧" : "Shift"
      if (p === "escape") return "Esc"
      if (p === "enter") return "Enter"
      return p.length === 1 ? p.toUpperCase() : p
    })
    .join(mac ? "" : " ")
}

function matches(event: KeyboardEvent, keys: string): boolean {
  const parts = keys.split("+").map((p) => p.trim().toLowerCase())
  const key = parts[parts.length - 1]
  const wantMod = parts.includes("mod")
  const wantAlt = parts.includes("alt")
  const wantShift = parts.includes("shift")

  const mod = isMac() ? event.metaKey : event.ctrlKey
  if (mod !== wantMod) return false
  if (event.altKey !== wantAlt) return false
  // "?" is typed with Shift on most layouts, so only enforce Shift when the
  // binding is a letter.
  if (key.length === 1 && /[a-z]/.test(key) && event.shiftKey !== wantShift) {
    return false
  }
  return event.key.toLowerCase() === key
}

/**
 * Binds the document's actions to the keyboard, the way a voucher screen
 * works: your hands never have to leave the keys.
 *
 * Bindings fire from inside text fields too — that is the point, since the
 * caret is almost always in one — except Escape, which the field or dialog
 * should get first.
 */
export function useVoucherKeys(actions: VoucherAction[], enabled = true) {
  const latest = useRef(actions)
  latest.current = actions

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      for (const action of latest.current) {
        if (action.disabled || !matches(event, action.keys)) continue
        event.preventDefault()
        event.stopPropagation()
        action.run()
        return
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [enabled])
}

/**
 * Enter moves to the next field instead of submitting.
 *
 * This is the single most valuable thing a voucher screen does: a bill is
 * entered top to bottom in one run, and on the web a stray Enter in the
 * supplier field would post a half-filled document. Saving is deliberate and
 * has its own key.
 */
export function useEnterAdvances() {
  return useCallback((event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    const target = event.target as HTMLElement
    const tag = target.tagName.toLowerCase()
    // A textarea needs its newlines, and a focused button or link means the
    // person is choosing something, not typing.
    if (tag === "textarea" || tag === "button" || tag === "a") return
    if (target.getAttribute("role") === "combobox") return
    // A select popup is portalled, but React still bubbles its events through
    // the React tree to this form. Enter in there is choosing an option, which
    // the select itself handles.
    if (target.closest('[role="listbox"], [role="option"], [role="dialog"]')) {
      return
    }

    const form = event.currentTarget
    const fields = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])'
      )
    ).filter((el) => el.offsetParent !== null)

    // Only act for something that is actually one of the fields. Without this
    // an unknown target gives indexOf -1, and fields[-1 + 1] is the *first*
    // field — so Enter anywhere unexpected threw the caret back to the top of
    // the voucher.
    const at = fields.indexOf(target)
    if (at === -1) return

    event.preventDefault()
    const next = fields[at + 1]
    if (next) {
      next.focus()
      if (next instanceof HTMLInputElement) next.select()
    }
  }, [])
}

/**
 * The action list down the side of the screen, which is Tally's best idea:
 * everything you can do, visible, without opening a menu.
 *
 * Where it differs is that the key is printed next to a real label rather than
 * abbreviated into something you have to already know.
 */
export function ActionRail({
  actions,
  className,
}: {
  actions: VoucherAction[]
  className?: string
}) {
  return (
    <nav
      aria-label="Voucher actions"
      className={cn(
        "flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible",
        className
      )}
    >
      {actions
        .filter((a) => !a.hidden)
        .map((action) => (
          <button
            key={action.keys + action.label}
            type="button"
            disabled={action.disabled}
            onClick={action.run}
            className={cn(
              "group flex shrink-0 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm whitespace-nowrap transition-colors",
              action.primary
                ? "bg-brand-soft text-brand hover:bg-brand-soft/80"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            {action.label}
            <kbd className="rounded border border-border/70 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:text-foreground">
              {prettyKeys(action.keys)}
            </kbd>
          </button>
        ))}
    </nav>
  )
}

/**
 * The full key list, on "?" — Tally's Ctrl+F1, except it names what each key
 * does in a sentence instead of leaving you to infer it.
 */
export function ShortcutHelp({
  actions,
  open,
  onClose,
}: {
  actions: VoucherAction[]
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  // Fixed rather than anchored to the dialog: anchoring would mean giving
  // DialogContent `relative`, which overrides its own `fixed` and drops the
  // whole dialog out of the centre of the screen.
  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border/70 bg-popover p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-medium">Keyboard</h4>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </div>
        <dl className="space-y-2 text-sm">
          {actions.map((action) => (
            <div
              key={action.keys + action.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt>
                {action.label}
                {action.hint ? (
                  <span className="block text-xs text-muted-foreground">{action.hint}</span>
                ) : null}
              </dt>
              <dd>
                <kbd className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {prettyKeys(action.keys)}
                </kbd>
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-t border-border/70 pt-2">
            <dt>
              Next field
              <span className="block text-xs text-muted-foreground">
                Enter never saves — a bill is entered top to bottom
              </span>
            </dt>
            <dd>
              <kbd className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Enter
              </kbd>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

/** The "press ? for keys" nudge, so the rail is discoverable at all. */
export function ShortcutHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <KeyboardIcon className="size-3.5" />
      Keys
      <kbd className="rounded border border-border/70 px-1 font-mono text-[10px]">?</kbd>
    </button>
  )
}

/** Wires the help overlay up to "?" alongside the document's own actions. */
export function useShortcutHelp() {
  const [open, setOpen] = useState(false)
  return useMemo(
    () => ({ open, show: () => setOpen(true), hide: () => setOpen(false) }),
    [open]
  )
}
