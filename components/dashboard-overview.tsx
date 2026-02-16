"use client"

import {
  Zap,
  Sun,
  BatteryCharging,
  ArrowDownToLine,
  ArrowUpFromLine,
  Home,
  Cpu,
  AlertTriangle,
  WifiOff,
} from "lucide-react"
import { MetricCard } from "@/components/metric-card"
import { InverterTable } from "@/components/inverter-table"
import { StatusSummary } from "@/components/status-summary"
import { useInverterList, useStationList } from "@/lib/solis-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DashboardOverview() {
  const { data: inverterData, error: inverterError, isLoading: invLoading } = useInverterList()
  const { data: stationData, isLoading: stLoading } = useStationList()

  const isLoading = invLoading || stLoading

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (inverterError) {
    return (
      <div className="flex h-96 items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h3 className="mb-1 font-semibold text-card-foreground">Connection Error</h3>
            <p className="text-sm text-muted-foreground">
              {inverterError.message || "Failed to connect to SolisCloud API. Please check your credentials in environment variables."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const inverters = inverterData?.page?.records || []
  const statusVo = inverterData?.inverterStatusVo || { all: 0, normal: 0, fault: 0, offline: 0 }

  // Calculate aggregate metrics
  const totalPowerNow = inverters.reduce((sum, inv) => sum + (inv.pac || 0), 0)
  const totalEnergyToday = inverters.reduce((sum, inv) => sum + (inv.etoday || 0), 0)
  const totalEnergyAll = inverters.reduce((sum, inv) => sum + (inv.etotal || 0), 0)
  const totalCapacity = inverters.reduce((sum, inv) => sum + (inv.power || 0), 0)

  // Station-level data
  const stations = stationData?.page?.records || []
  const totalGridImport = stations.reduce(
    (sum, s) => sum + (s.gridPurchasedTodayEnergy || 0),
    0
  )
  const totalGridExport = stations.reduce(
    (sum, s) => sum + (s.gridSellTodayEnergy || 0),
    0
  )
  const totalLoad = stations.reduce(
    (sum, s) => sum + (s.homeLoadTodayEnergy || 0),
    0
  )
  const totalBatteryCharge = stations.reduce(
    (sum, s) => sum + (s.batteryTodayChargeEnergy || 0),
    0
  )

  const powerUnit = inverters[0]?.pacStr || "kW"
  const energyUnit = inverters[0]?.etodayStr || "kWh"

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your solar energy system
        </p>
      </div>

      {/* Status Summary */}
      <StatusSummary
        total={statusVo.all}
        online={statusVo.normal}
        offline={statusVo.offline}
        alarm={statusVo.fault}
      />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Power"
          value={totalPowerNow}
          unit={powerUnit}
          icon={Zap}
          description="Real-time generation"
        />
        <MetricCard
          title="Today's Energy"
          value={totalEnergyToday}
          unit={energyUnit}
          icon={Sun}
          description="Generated today"
        />
        <MetricCard
          title="Total Energy"
          value={totalEnergyAll}
          unit={inverters[0]?.etotalStr || "MWh"}
          icon={Sun}
          description="Lifetime generation"
        />
        <MetricCard
          title="Installed Capacity"
          value={totalCapacity}
          unit={inverters[0]?.powerStr || "kW"}
          icon={Cpu}
          description={`${statusVo.all} inverter(s)`}
        />
        <MetricCard
          title="Grid Import Today"
          value={totalGridImport}
          unit="kWh"
          icon={ArrowDownToLine}
          description="Purchased from grid"
        />
        <MetricCard
          title="Grid Export Today"
          value={totalGridExport}
          unit="kWh"
          icon={ArrowUpFromLine}
          description="Sold to grid"
        />
        <MetricCard
          title="Home Load Today"
          value={totalLoad}
          unit="kWh"
          icon={Home}
          description="Consumed by loads"
        />
        <MetricCard
          title="Battery Charged"
          value={totalBatteryCharge}
          unit="kWh"
          icon={BatteryCharging}
          description="Today's charging"
        />
      </div>

      {/* Inverter Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-card-foreground">Inverters</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" /> {statusVo.all} total
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {statusVo.normal} online
              </span>
              <span className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> {statusVo.offline} offline
              </span>
              {statusVo.fault > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {statusVo.fault} alarm
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <InverterTable inverters={inverters} />
        </CardContent>
      </Card>
    </div>
  )
}
