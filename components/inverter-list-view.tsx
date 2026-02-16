"use client"

import { useInverterList } from "@/lib/solis-client"
import { InverterTable } from "@/components/inverter-table"
import { StatusSummary } from "@/components/status-summary"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export function InverterListView() {
  const { data, error, isLoading } = useInverterList()

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h3 className="mb-1 font-semibold text-card-foreground">Error Loading Inverters</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const inverters = data?.page?.records || []
  const statusVo = data?.inverterStatusVo || { all: 0, normal: 0, fault: 0, offline: 0 }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inverters</h1>
        <p className="text-sm text-muted-foreground">
          Manage and monitor all your inverter devices
        </p>
      </div>

      <StatusSummary
        total={statusVo.all}
        online={statusVo.normal}
        offline={statusVo.offline}
        alarm={statusVo.fault}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">
            All Inverters ({inverters.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <InverterTable inverters={inverters} />
        </CardContent>
      </Card>
    </div>
  )
}
