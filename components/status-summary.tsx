"use client"

import { Cpu, CheckCircle2, WifiOff, AlertTriangle } from "lucide-react"

interface StatusSummaryProps {
  total: number
  online: number
  offline: number
  alarm: number
}

export function StatusSummary({ total, online, offline, alarm }: StatusSummaryProps) {
  const items = [
    {
      label: "Total Inverters",
      value: total,
      icon: Cpu,
      color: "text-foreground",
      bg: "bg-secondary",
    },
    {
      label: "Online",
      value: online,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Offline",
      value: offline,
      icon: WifiOff,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
    {
      label: "Alarm",
      value: alarm,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-lg border bg-card p-3"
        >
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${item.bg}`}>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-card-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
