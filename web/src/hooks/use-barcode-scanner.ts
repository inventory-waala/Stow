"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { createFrameDecoder, type FrameDecoder, type ScanResult } from "@/lib/barcode/decoder"

export type ScannerStatus = "idle" | "starting" | "scanning" | "error"

export interface ScannerOptions {
  /** Called once per distinct code; the same value is ignored for `cooldownMs`. */
  onScan: (result: ScanResult) => void
  /** Open the camera while true; closing releases it. */
  active: boolean
  /** How long the same code must leave the frame before it is reported again. */
  cooldownMs?: number
  /** Short vibration + tick on every hit, so the user can look at the label, not the screen. */
  feedback?: boolean
}

/** Why the camera could not open, in words a shop-floor user can act on. */
function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow the camera for this site and try again."
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device."
    case "NotReadableError":
    case "AbortError":
      return "The camera is in use by another app."
  }
  return err instanceof Error && err.message ? err.message : "The camera could not be started."
}

function tick() {
  try {
    navigator.vibrate?.(40)
  } catch {}
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.value = 1760
    gain.gain.value = 0.04
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.06)
    osc.onended = () => void ctx.close()
  } catch {}
}

/**
 * Opens the rear camera into a `<video>` and decodes frames until a code is
 * read. Owns the stream, the decode loop, torch and camera switching; the
 * viewfinder component only renders. Stops itself when the tab is hidden.
 */
export function useBarcodeScanner({ onScan, active, cooldownMs = 1500, feedback = true }: ScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const decoderRef = useRef<FrameDecoder | null>(null)
  // Latest callbacks, read by the decode loop without restarting it.
  const onScanRef = useRef(onScan)
  const feedbackRef = useRef(feedback)
  useEffect(() => {
    onScanRef.current = onScan
    feedbackRef.current = feedback
  })
  // Each start() bumps this; a loop or a late getUserMedia from an older run bails out.
  const runRef = useRef(0)
  const lastHit = useRef<{ value: string; at: number } | null>(null)

  const [rawStatus, setStatus] = useState<ScannerStatus>("idle")
  // Off is off, whatever the last session ended in.
  const status: ScannerStatus = active ? rawStatus : "idle"
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<FrameDecoder["engine"] | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false })

  /** Ends the decode loop and closes the camera; no React state is touched. */
  const release = useCallback(() => {
    runRef.current += 1
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const stop = useCallback(() => {
    release()
    setTorch({ available: false, on: false })
    setStatus("idle")
  }, [release])

  const start = useCallback(
    async (preferredDeviceId?: string | null) => {
      const run = ++runRef.current
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setError(null)
      setStatus("starting")

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(
          window.isSecureContext
            ? "This browser cannot open the camera."
            : "The camera only works over HTTPS (or on localhost). Open the app from a secure address."
        )
        setStatus("error")
        return
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: preferredDeviceId
            ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }
        const [stream, decoder] = await Promise.all([
          navigator.mediaDevices.getUserMedia(constraints),
          decoderRef.current ? Promise.resolve(decoderRef.current) : createFrameDecoder(),
        ])
        decoderRef.current = decoder
        if (run !== runRef.current || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setEngine(decoder.engine)

        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        if (run !== runRef.current) return

        const track = stream.getVideoTracks()[0]
        setDeviceId(track?.getSettings().deviceId ?? preferredDeviceId ?? null)
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
        setTorch({ available: !!caps.torch, on: false })
        // Labels are only populated once permission is granted, so list now.
        navigator.mediaDevices
          .enumerateDevices()
          .then((all) => setCameras(all.filter((d) => d.kind === "videoinput")))
          .catch(() => {})

        setStatus("scanning")
        lastHit.current = null

        const interval = decoder.engine === "native" ? 90 : 160
        const loop = async () => {
          if (run !== runRef.current) return
          try {
            const hit = await decoder.decode(video)
            if (run !== runRef.current) return
            if (hit) {
              const now = Date.now()
              const last = lastHit.current
              if (!last || last.value !== hit.value || now - last.at > cooldownMs) {
                lastHit.current = { value: hit.value, at: now }
                if (feedbackRef.current) tick()
                onScanRef.current(hit)
              } else {
                // Still looking at the same label: keep the cooldown rolling.
                last.at = now
              }
            }
          } catch (err) {
            // A decoder failure ends the session; a transient one just skips the frame.
            if (run === runRef.current && err instanceof Error && /NotSupported|InvalidState/i.test(err.name)) {
              setError("Scanning failed in this browser. Type the code instead.")
              setStatus("error")
              return
            }
          }
          if (run === runRef.current) window.setTimeout(loop, interval)
        }
        void loop()
      } catch (err) {
        if (run !== runRef.current) return
        setError(describeCameraError(err))
        setStatus("error")
      }
    },
    [cooldownMs]
  )

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch.on
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch((t) => ({ ...t, on: next }))
    } catch {
      setTorch((t) => ({ ...t, available: false }))
    }
  }, [torch.on])

  const switchCamera = useCallback(
    (id: string) => {
      if (id !== deviceId) void start(id)
    },
    [deviceId, start]
  )

  /** Cycles to the next camera — the one-tap "flip" for phones with two. */
  const nextCamera = useCallback(() => {
    if (cameras.length < 2) return
    const i = cameras.findIndex((c) => c.deviceId === deviceId)
    switchCamera(cameras[(i + 1) % cameras.length].deviceId)
  }, [cameras, deviceId, switchCamera])

  useEffect(() => {
    if (!active) return
    // The camera is the external system this effect drives; `start` sets
    // state as it progresses, which is the point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start(null)
    return release
  }, [active, start, release])

  // Release the camera when the tab goes to the background; reopen on return.
  useEffect(() => {
    if (!active) return
    const onVisibility = () => {
      if (document.hidden) stop()
      else void start(deviceId)
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [active, deviceId, start, stop])

  useEffect(
    () => () => {
      decoderRef.current?.dispose()
      decoderRef.current = null
    },
    []
  )

  return { videoRef, status, error, engine, cameras, deviceId, torch, start, stop, toggleTorch, switchCamera, nextCamera }
}
