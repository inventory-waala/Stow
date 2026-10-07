"use client"

import { useState } from "react"
import { KeyboardIcon, ScanBarcodeIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CameraScanner } from "./camera-scanner"

/**
 * A scan button that sits next to any "scan or type" input. Opens the
 * viewfinder, reads one code, hands it back and closes — so every field
 * that accepts a barcode also accepts a phone camera.
 */
export function ScanButton({
  onScan,
  title = "Scan a barcode",
  hint,
  size = "icon",
  className,
  disabled,
  children,
}: {
  onScan: (value: string) => void
  title?: string
  hint?: string
  size?: "icon" | "icon-sm" | "icon-xs" | "icon-lg" | "sm" | "default"
  className?: string
  disabled?: boolean
  /** Button content; defaults to the barcode icon alone. */
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const accept = (value: string) => {
    const v = value.trim()
    if (!v) return
    onScan(v)
    setTyped("")
    setOpen(false)
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            disabled={disabled}
            aria-label={children ? undefined : title}
            title={title}
            className={cn("shrink-0", className)}
          >
            {children ?? <ScanBarcodeIcon />}
          </Button>
        }
      />
      <SheetContent side="bottom" className="mx-auto w-full rounded-t-2xl sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{hint ?? "Hold the label inside the frame. It reads as soon as it is in focus."}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-4">
          <CameraScanner active={open} hint={hint} onScan={(r) => accept(r.value)} />
          {/* The label may be smudged or the camera blocked: typing is always an option. */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              accept(typed)
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <KeyboardIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Or type the code"
                aria-label="Type the barcode"
                autoComplete="off"
                inputMode="text"
                maxLength={128}
                className="pl-8 font-mono text-xs"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!typed.trim()} className="rounded-full">
              Use
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
