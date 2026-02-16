"use client"

import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import type { InverterRecord } from "@/lib/solis-client"

interface InverterTableProps {
  inverters: InverterRecord[]
}

export function InverterTable({ inverters }: InverterTableProps) {
  const router = useRouter()

  if (!inverters.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No inverters found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-t bg-muted/50">
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name / SN
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Power
            </th>
            <th className="hidden px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
              Today
            </th>
            <th className="hidden px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
              Total
            </th>
            <th className="hidden px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">
              Station
            </th>
            <th className="w-10 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {inverters.map((inv) => (
            <tr
              key={inv.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/inverters/${inv.id}?sn=${inv.sn}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  router.push(`/inverters/${inv.id}?sn=${inv.sn}`)
                }
              }}
              className="border-t cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-card-foreground">
                    {inv.name || inv.sn}
                  </p>
                  {inv.name && (
                    <p className="text-xs text-muted-foreground">{inv.sn}</p>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge state={inv.state} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-card-foreground">
                {inv.pac?.toFixed(2)} <span className="text-muted-foreground">{inv.pacStr}</span>
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-card-foreground sm:table-cell">
                {inv.etoday?.toFixed(1)} <span className="text-muted-foreground">{inv.etodayStr}</span>
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-card-foreground md:table-cell">
                {inv.etotal?.toFixed(1)} <span className="text-muted-foreground">{inv.etotalStr}</span>
              </td>
              <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
                {inv.stationName || "-"}
              </td>
              <td className="px-4 py-3 text-right">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
