"use client"

import { useState, useMemo } from "react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

interface EnergyBarChartProps {
  data: {
    label: string
    energy: number
    gridSell?: number
    gridPurchased?: number
    homeLoad?: number
    batteryCharge?: number
    batteryDischarge?: number
  }[]
  xLabel?: string
}

const SERIES = {
  energy:           { label: "Generation",      color: "hsl(36, 90%, 50%)" },
  homeLoad:         { label: "Home Load",        color: "hsl(220, 70%, 55%)" },
  gridPurchased:    { label: "Grid Import",      color: "hsl(0, 75%, 55%)" },
  gridSell:         { label: "Grid Export",       color: "hsl(142, 71%, 45%)" },
  batteryCharge:    { label: "Batt Charge",      color: "hsl(280, 65%, 55%)" },
  batteryDischarge: { label: "Batt Discharge",   color: "hsl(170, 60%, 45%)" },
} as const

type SeriesKey = keyof typeof SERIES

export function EnergyBarChart({ data, xLabel }: EnergyBarChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data available for this period
      </div>
    )
  }

  // Determine which series have data
  const available = useMemo(() => {
    const set = new Set<SeriesKey>()
    set.add("energy") // always show generation
    const MAX_SERIES = 6 // total keys in SERIES

    for (const d of data) {
      if (set.size === MAX_SERIES) break
      if ((d.gridSell || 0) > 0) set.add("gridSell")
      if ((d.gridPurchased || 0) > 0) set.add("gridPurchased")
      if ((d.homeLoad || 0) > 0) set.add("homeLoad")
      if ((d.batteryCharge || 0) > 0) set.add("batteryCharge")
      if ((d.batteryDischarge || 0) > 0) set.add("batteryDischarge")
    }
    return set
  }, [data])

  const toggleSeries = (key: SeriesKey) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isVisible = (key: SeriesKey) => available.has(key) && !hidden.has(key)

  // Order for rendering
  const order: SeriesKey[] = ["energy", "homeLoad", "gridPurchased", "gridSell", "batteryCharge", "batteryDischarge"]

  return (
    <div className="space-y-2">
      {/* Clickable legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {order.filter((k) => available.has(k)).map((key) => {
          const s = SERIES[key]
          const active = isVisible(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleSeries(key)}
              className="flex items-center gap-1.5 text-[10px] transition-opacity"
              style={{ opacity: active ? 1 : 0.3 }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className={active ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
            </button>
          )
        })}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={44}
              unit=" kWh"
            />
            <Tooltip
              cursor={{ fill: "hsl(224, 14%, 16%, 0.5)" }}
              contentStyle={{
                backgroundColor: "hsl(224, 18%, 9%)",
                border: "1px solid hsl(224, 14%, 16%)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "hsl(220, 10%, 94%)",
              }}
              formatter={(value: number, name: string) => {
                const label = SERIES[name as SeriesKey]?.label ?? name
                return [`${value.toFixed(2)} kWh`, label]
              }}
            />
            {order.map((key) =>
              isVisible(key) ? (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={SERIES[key].color}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={16}
                />
              ) : null
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
