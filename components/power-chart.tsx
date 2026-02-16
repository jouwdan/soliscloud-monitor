"use client"

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import type { InverterDayEntry } from "@/lib/solis-client"
import { toKW } from "@/lib/solis-client"

interface PowerChartProps {
  data: InverterDayEntry[]
}

/** Normalise a Solis timestamp to milliseconds */
function toMs(raw: string | number): number {
  const n = Number(raw)
  // If it looks like seconds (< 1e12), convert to ms
  return n > 0 && n < 1e12 ? n * 1000 : n
}

/** Format a ms timestamp to HH:MM local time */
function fmtTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function PowerChart({ data }: PowerChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data available for today
      </div>
    )
  }

  // Sort by timestamp and normalise power to kW
  const chartData = [...data]
    .sort((a, b) => toMs(a.dataTimestamp) - toMs(b.dataTimestamp))
    .map((entry) => ({
      time: fmtTime(toMs(entry.dataTimestamp)),
      power: toKW(entry.pac, entry.pacStr),
    }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(36, 90%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(36, 90%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={false}
            width={45}
            tickFormatter={(v) => `${v} kW`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(224, 18%, 9%)",
              border: "1px solid hsl(224, 14%, 16%)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(220, 10%, 94%)",
            }}
            formatter={(value: number) => [`${value.toFixed(2)} kW`, "Power"]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="power"
            stroke="hsl(36, 90%, 50%)"
            strokeWidth={2}
            fill="url(#powerGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
