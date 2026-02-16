"use client"

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"

interface EnergyBarChartProps {
  data: {
    label: string
    energy: number
    gridSell?: number
    gridPurchased?: number
  }[]
  xLabel?: string
}

export function EnergyBarChart({ data, xLabel }: EnergyBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data available for this period
      </div>
    )
  }

  const hasGridData = data.some((d) => (d.gridSell || 0) > 0 || (d.gridPurchased || 0) > 0)

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={false}
            label={xLabel ? { value: xLabel, position: "insideBottom", offset: -5, fontSize: 11, fill: "hsl(220, 10%, 50%)" } : undefined}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(224, 18%, 9%)",
              border: "1px solid hsl(224, 14%, 16%)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(220, 10%, 94%)",
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                energy: "Generation",
                gridSell: "Grid Export",
                gridPurchased: "Grid Import",
              }
              return [`${value.toFixed(2)} kWh`, labels[name] || name]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                energy: "Generation",
                gridSell: "Grid Export",
                gridPurchased: "Grid Import",
              }
              return labels[value] || value
            }}
          />
          <Bar
            dataKey="energy"
            fill="hsl(36, 90%, 50%)"
            radius={[3, 3, 0, 0]}
            maxBarSize={20}
          />
          {hasGridData && (
            <>
              <Bar
                dataKey="gridSell"
                fill="hsl(142, 71%, 45%)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
              <Bar
                dataKey="gridPurchased"
                fill="hsl(220, 70%, 50%)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
