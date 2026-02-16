"use client"

import { useState } from "react"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAlarmList } from "@/lib/solis-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function AlarmLevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; icon: typeof AlertTriangle; className: string }> = {
    "1": {
      label: "Tip",
      icon: Info,
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    "2": {
      label: "General",
      icon: AlertCircle,
      className: "bg-primary/10 text-primary",
    },
    "3": {
      label: "Emergency",
      icon: AlertTriangle,
      className: "bg-destructive/10 text-destructive",
    },
  }

  const { label, icon: Icon, className } = config[level] || config["1"]

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function AlarmStateBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; icon: typeof Clock; className: string }> = {
    "0": {
      label: "Pending",
      icon: Clock,
      className: "bg-primary/10 text-primary",
    },
    "1": {
      label: "Processed",
      icon: CheckCircle2,
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    "2": {
      label: "Restored",
      icon: CheckCircle2,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  }

  const { label, icon: Icon, className } = config[state] || config["0"]

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function AlarmsView() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading } = useAlarmList(page, 20)

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h3 className="mb-1 font-semibold text-card-foreground">Error Loading Alarms</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const alarms = data?.records || []
  const total = data?.total || 0
  const totalPages = data?.pages || 1

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alarms</h1>
        <p className="text-sm text-muted-foreground">
          {total} alarm record{total !== 1 ? "s" : ""} found
        </p>
      </div>

      {alarms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
            <h3 className="mb-1 text-lg font-semibold text-card-foreground">All Clear</h3>
            <p className="text-sm text-muted-foreground">
              No alarm records found for your account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Alarm History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t bg-muted/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Device
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Level
                    </th>
                    <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Message
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                      Start Time
                    </th>
                    <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">
                      Station
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alarms.map((alarm, idx) => (
                    <tr key={`${alarm.id}-${idx}`} className="border-t transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-medium text-card-foreground">{alarm.alarmDeviceSn}</p>
                        <p className="text-xs text-muted-foreground">Code: {alarm.alarmCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <AlarmLevelBadge level={alarm.alarmLevel} />
                      </td>
                      <td className="hidden max-w-xs truncate px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                        {alarm.alarmMsg || "N/A"}
                        {alarm.advice && (
                          <p className="mt-0.5 text-xs text-primary">{alarm.advice}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AlarmStateBadge state={alarm.state} />
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                        {alarm.alarmBeginTime
                          ? new Date(alarm.alarmBeginTime).toLocaleString()
                          : "N/A"}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                        {alarm.stationName || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
