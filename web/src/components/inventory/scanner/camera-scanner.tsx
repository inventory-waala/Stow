"use client"

import { useState } from "react"
import { CameraIcon, CameraOffIcon, RefreshCwIcon, SwitchCameraIcon, ZapIcon, ZapOffIcon } from "lucide-react"

import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"
import type { ScanResult } from "@/lib/barcode/decoder"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * The viewfinder: rear-camera video with a reticle, torch and flip
 * controls, and the states around it (starting, blocked, no camera). Reports
 * every code it reads through `onScan`; the owner decides what to do and
 * whether to keep scanning.
 */
export function CameraScanner({
  active,
  onScan,
  className,
  cooldownMs,
  /** A short line under the reticle — what the user is scanning *for*. */
  hint,
}: {
  active: boolean
  onScan: (result: ScanResult) => void
  className?: string
  cooldownMs?: number
  hint?: string
}) {
  const [flash, setFlash] = useState(0)
  const { videoRef, status, error, engine, cameras, torch, start, toggleTorch, nextCamera } = useBarcodeScanner({
    active,
    cooldownMs,
    onScan: (r) => {
      // Brief green edge so the hit is visible from arm's length.
      setFlash((n) => n + 1)
      onScan(r)
    },
  })

  return (
    <div
      className={cn(
        "relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-black text-white sm:aspect-video",
        className
      )}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
        className={cn("size-full object-cover", status !== "scanning" && "opacity-0")}
      />

      {status === "scanning" ? (
        <>
          <Reticle key={flash} pulse={flash > 0} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/60 to-transparent p-3">
            <p className="text-xs text-white/85 drop-shadow">{hint ?? "Point at a barcode"}</p>
            <div className="pointer-events-auto flex items-center gap-1">
              {torch.available ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => void toggleTorch()}
                  aria-pressed={torch.on}
                  aria-label={torch.on ? "Turn torch off" : "Turn torch on"}
                  className="rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  {torch.on ? <ZapOffIcon /> : <ZapIcon />}
                </Button>
              ) : null}
              {cameras.length > 1 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={nextCamera}
                  aria-label="Switch camera"
                  className="rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  <SwitchCameraIcon />
                </Button>
              ) : null}
            </div>
          </div>
          {engine ? (
            <span className="absolute top-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] tracking-wide text-white/70 uppercase">
              {engine === "native" ? "camera" : "js"}
            </span>
          ) : null}
        </>
      ) : null}

      {status === "starting" ? (
        <Center>
          <CameraIcon className="size-6 animate-pulse text-white/70" />
          <p className="text-sm text-white/80">Opening camera…</p>
        </Center>
      ) : null}

      {status === "error" ? (
        <Center>
          <CameraOffIcon className="size-6 text-white/70" />
          <p className="max-w-xs text-sm text-white/85">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void start(null)}
            className="mt-1 rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCwIcon /> Try again
          </Button>
        </Center>
      ) : null}

      {status === "idle" && !active ? (
        <Center>
          <CameraOffIcon className="size-6 text-white/50" />
          <p className="text-sm text-white/60">Camera off</p>
        </Center>
      ) : null}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">{children}</div>
  )
}

/** Corner brackets around the sweet spot; flashes green on a read. */
function Reticle({ pulse }: { pulse: boolean }) {
  const corner = "absolute size-6 border-white/90"
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={cn(
          "relative h-[38%] w-[72%] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]",
          pulse && "animate-[scan-hit_600ms_ease-out]"
        )}
      >
        <span className={cn(corner, "top-0 left-0 rounded-tl-lg border-t-3 border-l-3")} />
        <span className={cn(corner, "top-0 right-0 rounded-tr-lg border-t-3 border-r-3")} />
        <span className={cn(corner, "bottom-0 left-0 rounded-bl-lg border-b-3 border-l-3")} />
        <span className={cn(corner, "right-0 bottom-0 rounded-br-lg border-r-3 border-b-3")} />
        <span className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-brand/80 shadow-[0_0_8px_var(--brand)]" />
      </div>
      <style>{`@keyframes scan-hit{0%{box-shadow:0 0 0 9999px rgba(0,0,0,.25),inset 0 0 0 3px var(--brand)}100%{box-shadow:0 0 0 9999px rgba(0,0,0,.25),inset 0 0 0 0 transparent}}`}</style>
    </div>
  )
}
