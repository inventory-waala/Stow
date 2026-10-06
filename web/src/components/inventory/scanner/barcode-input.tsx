"use client"

import { useRef } from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScanButton } from "./scan-button"

/**
 * An uncontrolled barcode field for forms: a hardware scanner types into
 * the input, a phone uses the camera button beside it. Either way the value
 * lands in `name` for the server action. `submitOnScan` posts the form as
 * soon as the camera reads a code — for one-field forms like "Assign".
 */
export function BarcodeInput({
  name,
  placeholder = "Scan or type",
  className,
  inputClassName,
  size = "icon",
  submitOnScan = false,
  ...rest
}: Omit<React.ComponentProps<typeof Input>, "size" | "name"> & {
  name: string
  inputClassName?: string
  size?: "icon" | "icon-sm" | "icon-xs"
  submitOnScan?: boolean
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        ref={ref}
        name={name}
        placeholder={placeholder}
        maxLength={128}
        autoComplete="off"
        className={cn("font-mono text-xs", inputClassName)}
        {...rest}
      />
      <ScanButton
        size={size}
        disabled={rest.disabled}
        title="Scan with the camera"
        onScan={(v) => {
          const el = ref.current
          if (!el) return
          el.value = v
          if (submitOnScan) el.form?.requestSubmit()
          else el.focus()
        }}
      />
    </div>
  )
}
