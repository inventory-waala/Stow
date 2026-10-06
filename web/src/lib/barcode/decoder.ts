/**
 * Frame decoders for the camera scanner. Two engines behind one interface:
 *
 * - The browser's `BarcodeDetector` (Chrome / Edge on Android and desktop):
 *   hardware-backed, fast, and the best reader of 1D retail codes.
 * - `@zxing/browser` (pure JS) everywhere else — iOS Safari, Firefox — so
 *   the scanner works on any phone, only slower on dim or blurry labels.
 *
 * Both take frames from a `<video>` the scanner hook owns; the engines
 * never open the camera themselves.
 */

/** Symbologies we ask for — the ones on retail labels plus QR for shelf tags. */
export const SCAN_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "itf",
  "qr_code",
  "data_matrix",
  "pdf417",
  "aztec",
] as const

export type ScanFormat = (typeof SCAN_FORMATS)[number]

export interface ScanResult {
  value: string
  format: ScanFormat | "unknown"
}

export interface FrameDecoder {
  /** Which engine is running — shown in the viewfinder so support issues are diagnosable. */
  readonly engine: "native" | "zxing"
  /** Decodes the current frame; `null` when nothing readable is in view. */
  decode(video: HTMLVideoElement): Promise<ScanResult | null>
  dispose(): void
}

// The Shape Detection API is not in TypeScript's DOM lib yet.
interface DetectedBarcode {
  rawValue: string
  format: string
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

const nativeCtor = (): BarcodeDetectorCtor | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector

const asFormat = (f: string): ScanResult["format"] =>
  (SCAN_FORMATS as readonly string[]).includes(f) ? (f as ScanFormat) : "unknown"

async function createNativeDecoder(): Promise<FrameDecoder | null> {
  const Ctor = nativeCtor()
  if (!Ctor) return null
  let formats: string[]
  try {
    const supported = await Ctor.getSupportedFormats()
    formats = SCAN_FORMATS.filter((f) => supported.includes(f))
  } catch {
    return null
  }
  // Some builds expose the constructor but no formats (desktop Linux Chrome
  // without the ML library); the JS engine is the better choice there.
  if (!formats.length) return null
  const detector = new Ctor({ formats })
  return {
    engine: "native",
    async decode(video) {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null
      const found = await detector.detect(video)
      const hit = found.find((b) => b.rawValue)
      return hit ? { value: hit.rawValue, format: asFormat(hit.format) } : null
    },
    dispose() {},
  }
}

async function createZxingDecoder(): Promise<FrameDecoder> {
  // Loaded on demand: ~300 KB that desktop Chrome users never need.
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType, NotFoundException }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ])
  const zxingFormats: Record<ScanFormat, number> = {
    ean_13: BarcodeFormat.EAN_13,
    ean_8: BarcodeFormat.EAN_8,
    upc_a: BarcodeFormat.UPC_A,
    upc_e: BarcodeFormat.UPC_E,
    code_128: BarcodeFormat.CODE_128,
    code_39: BarcodeFormat.CODE_39,
    code_93: BarcodeFormat.CODE_93,
    codabar: BarcodeFormat.CODABAR,
    itf: BarcodeFormat.ITF,
    qr_code: BarcodeFormat.QR_CODE,
    data_matrix: BarcodeFormat.DATA_MATRIX,
    pdf417: BarcodeFormat.PDF_417,
    aztec: BarcodeFormat.AZTEC,
  }
  const backToScan = new Map<number, ScanFormat>(
    (Object.entries(zxingFormats) as Array<[ScanFormat, number]>).map(([k, v]) => [v, k])
  )
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, Object.values(zxingFormats))
  hints.set(DecodeHintType.TRY_HARDER, true)
  const reader = new BrowserMultiFormatReader(hints)

  // ZXing reads from a canvas; we copy the frame at a bounded size because
  // decoding a full 1080p frame on a phone CPU is what makes JS scanners lag.
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const MAX_EDGE = 960

  return {
    engine: "zxing",
    async decode(video) {
      if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null
      const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight))
      const w = Math.round(video.videoWidth * scale)
      const h = Math.round(video.videoHeight * scale)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.drawImage(video, 0, 0, w, h)
      try {
        const result = reader.decodeFromCanvas(canvas)
        const text = result.getText()
        return text ? { value: text, format: backToScan.get(result.getBarcodeFormat()) ?? "unknown" } : null
      } catch (err) {
        // "Nothing in this frame" is the normal outcome, not an error.
        if (err instanceof NotFoundException) return null
        if (err instanceof Error && /NotFound|No MultiFormat Readers/i.test(err.name + err.message)) return null
        throw err
      }
    },
    dispose() {
      canvas.width = 0
      canvas.height = 0
    },
  }
}

/** Picks the native engine when the browser has one, else the JS fallback. */
export async function createFrameDecoder(): Promise<FrameDecoder> {
  return (await createNativeDecoder()) ?? createZxingDecoder()
}
