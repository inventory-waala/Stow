"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { MOVEMENT } from "@/components/dashboard/data"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const config = {
  received: { label: "Received", color: "var(--brand)" },
  shipped: { label: "Shipped", color: "var(--foreground)" },
} satisfies ChartConfig

const RANGES = [
  { value: "7", label: "7d" },
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
]

export function MovementChart() {
  const [range, setRange] = React.useState("30")
  const data = MOVEMENT.slice(MOVEMENT.length - Number(range))
  const shipped = data.reduce((n, d) => n + d.shipped, 0)
  const received = data.reduce((n, d) => n + d.received, 0)

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-ambient">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Stock movement</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Units in and out of the main warehouse
          </p>
        </div>
        <ToggleGroup
          value={[range]}
          onValueChange={(v) => v[0] && setRange(String(v[0]))}
          variant="outline"
          aria-label="Date range"
        >
          {RANGES.map((r) => (
            <ToggleGroupItem
              key={r.value}
              value={r.value}
              className="h-8 px-3 text-xs data-pressed:bg-secondary"
            >
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <dl className="mt-5 flex gap-8 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
            Received
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular">
            {received.toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-foreground" aria-hidden="true" />
            Shipped
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular">
            {shipped.toLocaleString("en-US")}
          </dd>
        </div>
      </dl>

      <ChartContainer config={config} className="mt-4 aspect-auto h-56 w-full min-w-0 flex-1 overflow-hidden">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillReceived" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={28}
            tick={{ fontSize: 11 }}
          />
          <YAxis hide domain={[0, "dataMax + 60"]} />
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_, payload) => payload?.[0]?.payload.label}
              />
            }
          />
          <Area
            dataKey="shipped"
            type="monotone"
            stroke="var(--foreground)"
            strokeWidth={1.5}
            fill="transparent"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Area
            dataKey="received"
            type="monotone"
            stroke="var(--brand)"
            strokeWidth={2}
            fill="url(#fillReceived)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ChartContainer>
    </section>
  )
}
