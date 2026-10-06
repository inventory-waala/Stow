import { ImageResponse } from "next/og"

import { BRAND } from "@/components/brand/logo"

export const alt = `${BRAND}: inventory that stays accurate`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#fafafa",
          color: "#18181b",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#2f8a63",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 11.5h16v6a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
              <path d="M4 11.5 5.8 4.6 20 8" />
              <circle cx="12" cy="15.75" r="1.25" fill="#fff" stroke="none" />
            </svg>
          </div>
          {BRAND}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
            Know what is on the shelf.
          </div>
          <div style={{ fontSize: 36, color: "#52525b" }}>
            Inventory, purchases and orders that stay accurate.
          </div>
        </div>
      </div>
    ),
    size
  )
}
