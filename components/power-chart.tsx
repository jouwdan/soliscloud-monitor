"use client"

import { useState } from "react"
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import type { InverterDayEntry } from "@/lib/solis-client"
import { toKW } from "@/lib/solis-client"

interface PowerChartProps {
  data: InverterDayEntry[]
}

/** Normalise a Solis timestamp to milliseconds */
function toMs(raw: string | number): number {
  const n = Number(raw)
  return n > 0 && n < 1e12 ? n * 1000 : n
}

/** Format a ms timestamp to HH:MM local time */
function fmtTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

const SERIES = {
  solar:      { label: "Solar",          color: "hsl(36, 90%, 50%)"  },
  homeLoad:   { label: "Home Load",      color: "hsl(220, 70%, 55%)" },
  battCharge: { label: "Batt Charge",    color: "hsl(142, 70%, 45%)" },
  battDrain:  { label: "Batt Discharge", color: "hsl(280, 65%, 55%)" },
  gridImport: { label: "Grid Import",    color: "hsl(0, 75%, 55%)"   },
  gridExport: { label: "Grid Export",    color: "hsl(200, 80%, 50%)" },
} as const

type SeriesKey = keyof typeof SERIES

interface RawPoint {
  ts: number
  solar: number
  homeLoad: number
  battCharge: number
  battDrain: number
  gridImport: number
  gridExport: number
}

/** Bucket raw points into 5-minute averages */
function bucketTo5Min(points: RawPoint[]): (Omit<RawPoint, "ts"> & { time: string })[] {
  const FIVE_MIN = 5 * 60 * 1000
  const buckets = new Map<number, RawPoint[]>()

  for (const p of points) {
    const key = Math.floor(p.ts / FIVE_MIN) * FIVE_MIN
    const arr = buckets.get(key)
    if (arr) arr.push(p)
    else buckets.set(key, [p])
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, pts]) => {
      const n = pts.length
      return {
        time: fmtTime(key),
        solar: pts.reduce((s, p) => s + p.solar, 0) / n,
        homeLoad: pts.reduce((s, p) => s + p.homeLoad, 0) / n,
        battCharge: pts.reduce((s, p) => s + p.battCharge, 0) / n,
        battDrain: pts.reduce((s, p) => s + p.battDrain, 0) / n,
        gridImport: pts.reduce((s, p) => s + p.gridImport, 0) / n,
        gridExport: pts.reduce((s, p) => s + p.gridExport, 0) / n,
      }
    })
}

export function PowerChart({ data }: PowerChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data available for today
      </div>
    )
  }

  const toggle = (key: SeriesKey) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Sort, normalise to kW, then bucket into 5-min averages
  const rawPoints: RawPoint[] = [...data]
    .sort((a, b) => toMs(a.dataTimestamp) - toMs(b.dataTimestamp))
    .map((entry) => {
      const batt = toKW(entry.batteryPower, entry.batteryPowerStr, entry.batteryPowerPec)
      const grid = toKW(entry.pSum, entry.pSumStr, (entry as Record<string, unknown>).psumCalPec as string | undefined ?? (entry as Record<string, unknown>).pSumPec as string | undefined)

      return {
        ts: toMs(entry.dataTimestamp),
        solar: toKW(entry.pac, entry.pacStr, entry.pacPec),
        homeLoad: toKW(entry.familyLoadPower, entry.familyLoadPowerStr, entry.familyLoadPowerPec),
        battCharge: batt > 0 ? batt : 0,
        battDrain: batt < 0 ? Math.abs(batt) : 0,
        gridImport: grid > 0 ? grid : 0,
        gridExport: grid < 0 ? Math.abs(grid) : 0,
      }
    })

  const chartData = bucketTo5Min(rawPoints)

  return (
    <div className="space-y-2">
      {/* Custom legend with toggle */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {(Object.entries(SERIES) as [SeriesKey, (typeof SERIES)[SeriesKey]][]).map(([key, s]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 text-[10px] transition-opacity"
            style={{ opacity: hidden.has(key) ? 0.35 : 1 }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${v}`}
              label={{ value: "kW", position: "insideTopLeft", offset: -5, style: { fontSize: 9, fill: "hsl(220, 10%, 50%)" } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(224, 18%, 9%)",
                border: "1px solid hsl(224, 14%, 16%)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "hsl(220, 10%, 94%)",
              }}
              formatter={(value: number, name: string) => {
                const label = SERIES[name as SeriesKey]?.label ?? name
                return [`${value.toFixed(2)} kW`, label]
              }}
              labelFormatter={(label) => `${label}`}
            />
            {(Object.entries(SERIES) as [SeriesKey, (typeof SERIES)[SeriesKey]][]).map(([key, s]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                hide={hidden.has(key)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
