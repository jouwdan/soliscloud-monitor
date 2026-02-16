"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Zap,
  Sun,
  BatteryCharging,
  Battery,
  ArrowDownToLine,
  ArrowUpFromLine,
  Home,
  Thermometer,
  Clock,
  AlertTriangle,
  Info,
  Leaf,
  PlugZap,
  ShieldCheck,
  Activity,
  Gauge,
} from "lucide-react"
import { useInverterDetail, useInverterDay, useInverterMonth, useInverterYear } from "@/lib/solis-client"
import { MetricCard } from "@/components/metric-card"
import { StatusBadge } from "@/components/status-badge"
import { PowerChart } from "@/components/power-chart"
import { EnergyBarChart } from "@/components/energy-bar-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

interface InverterDetailViewProps {
  id: string
  sn: string
}

export function InverterDetailView({ id, sn }: InverterDetailViewProps) {
  const { data: detail, error, isLoading } = useInverterDetail(id, sn)
  const [chartTab, setChartTab] = useState("day")

  const today = format(new Date(), "yyyy-MM-dd")
  const thisMonth = format(new Date(), "yyyy-MM")
  const thisYear = format(new Date(), "yyyy")

  const { data: dayData } = useInverterDay(id, sn, today, "8")
  const { data: monthData } = useInverterMonth(id, sn, thisMonth)
  const { data: yearData } = useInverterYear(id, sn, thisYear)

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex h-96 items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h3 className="mb-1 font-semibold text-card-foreground">Error Loading Inverter</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || "Inverter data not available"}
            </p>
            <Link href="/inverters">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Inverters
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const lastUpdate = detail.dataTimestamp
    ? new Date(Number(detail.dataTimestamp)).toLocaleString()
    : "N/A"

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/inverters"
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                {detail.name || detail.sn}
              </h1>
              <StatusBadge state={detail.state} />
            </div>
            <p className="text-sm text-muted-foreground">
              SN: {detail.sn} &middot; {detail.model || "N/A"} &middot; {detail.stationName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last updated: {lastUpdate}
        </div>
      </div>

      {/* Inverter Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Model</span>
              <p className="font-medium text-card-foreground">{detail.model || "N/A"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium text-card-foreground">{detail.type === 2 ? "Storage" : "Grid-tied"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Firmware</span>
              <p className="font-mono text-xs font-medium text-card-foreground">{detail.version || "N/A"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Capacity</span>
              <p className="font-medium text-card-foreground">
                {detail.power} {detail.powerStr}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Power"
          value={detail.pac || 0}
          unit={detail.pacStr}
          icon={Zap}
        />
        <MetricCard
          title="Today"
          value={detail.eToday || 0}
          unit={detail.eTodayStr}
          icon={Sun}
        />
        <MetricCard
          title="This Month"
          value={detail.eMonth || 0}
          unit={detail.eMonthStr}
          icon={Sun}
        />
        <MetricCard
          title="Total"
          value={detail.eTotal || 0}
          unit={detail.eTotalStr}
          icon={Sun}
        />
      </div>

      {/* Battery & Grid Real-time */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Battery Power"
          value={detail.batteryPower || 0}
          unit={detail.batteryPowerStr || "kW"}
          icon={BatteryCharging}
          description={`SOC: ${detail.batteryCapacitySoc?.toFixed(0) || 0}% | SOH: ${detail.batteryHealthSoh?.toFixed(0) || 0}%`}
        />
        <MetricCard
          title="Home Load"
          value={detail.familyLoadPower || 0}
          unit={detail.familyLoadPowerStr || "kW"}
          icon={Home}
          description={`Today: ${detail.homeLoadTodayEnergy?.toFixed(1) || 0} ${detail.homeLoadTodayEnergyStr || "kWh"}`}
        />
        <MetricCard
          title="Grid Power"
          value={Math.abs(detail.pSum || 0)}
          unit={detail.pSumStr || "kW"}
          icon={(detail.pSum || 0) >= 0 ? ArrowDownToLine : ArrowUpFromLine}
          description={(detail.pSum || 0) >= 0 ? "Importing from grid" : "Exporting to grid"}
        />
        <MetricCard
          title="DC Input Total"
          value={detail.dcPac || 0}
          unit={detail.dcPacStr || "W"}
          icon={Zap}
          description={detail.bypassLoadPower ? `Bypass: ${detail.bypassLoadPower.toFixed(2)} ${detail.bypassLoadPowerStr || "kW"}` : undefined}
        />
      </div>

      {/* Self-Reliance & Energy Flow */}
      {detail.type === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
              <Leaf className="h-4 w-4 text-emerald-500" />
              Self-Reliance & Energy Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Self-consumption / Self-reliance gauges */}
            {(() => {
              const produced = detail.eToday || 0
              const exported = detail.gridSellTodayEnergy || 0
              const imported = detail.gridPurchasedTodayEnergy || 0
              const consumed = detail.homeLoadTodayEnergy || 0

              const selfConsumed = Math.max(0, produced - exported)
              const selfConsumptionRate = produced > 0
                ? Math.min(100, (selfConsumed / produced) * 100)
                : 0
              const selfRelianceRate = consumed > 0
                ? Math.min(100, (selfConsumed / consumed) * 100)
                : 0

              return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4 text-center">
                    <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
                    <p className="text-xs font-medium text-muted-foreground">Self-Reliance</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">
                      {selfRelianceRate.toFixed(0)}%
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${selfRelianceRate}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      of load met by solar
                    </p>
                  </div>

                  <div className="rounded-lg border p-4 text-center">
                    <Sun className="mx-auto mb-2 h-5 w-5 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Self-Consumption</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">
                      {selfConsumptionRate.toFixed(0)}%
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${selfConsumptionRate}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      of production used directly
                    </p>
                  </div>

                  <div className="rounded-lg border p-4 text-center">
                    <Activity className="mx-auto mb-2 h-5 w-5 text-blue-500" />
                    <p className="text-xs font-medium text-muted-foreground">Grid Power</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">
                      {Math.abs(detail.pSum || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">{detail.pSumStr || "kW"}</p>
                    <p className="mt-1 text-xs font-medium" style={{ color: (detail.pSum || 0) >= 0 ? "hsl(var(--chart-5))" : "hsl(var(--chart-4))" }}>
                      {(detail.pSum || 0) >= 0 ? "Importing" : "Exporting"}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4 text-center">
                    <Gauge className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Home Load</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">
                      {(detail.familyLoadPower || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">{detail.familyLoadPowerStr || "kW"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detail.familyLoadPercent ? `${detail.familyLoadPercent}% capacity` : "Current draw"}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Detailed energy breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Metric</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Today</th>
                    <th className="hidden px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Month</th>
                    <th className="hidden px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">Year</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <Sun className="h-3.5 w-3.5 text-primary" /> Production
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.eToday?.toFixed(1)} <span className="text-muted-foreground">{detail.eTodayStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground sm:table-cell">
                      {detail.eMonth?.toFixed(1)} <span className="text-muted-foreground">{detail.eMonthStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground md:table-cell">
                      {detail.eYear?.toFixed(1)} <span className="text-muted-foreground">{detail.eYearStr}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.eTotal?.toFixed(1)} <span className="text-muted-foreground">{detail.eTotalStr}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <Home className="h-3.5 w-3.5 text-muted-foreground" /> Consumption
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.homeLoadTodayEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.homeLoadTodayEnergyStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground sm:table-cell">
                      {(detail.homeLoadMonthEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.homeLoadMonthEnergyStr || "kWh"}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground md:table-cell">
                      {(detail.homeLoadYearEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.homeLoadYearEnergyStr || "kWh"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.homeLoadTotalEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.homeLoadTotalEnergyStr}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <ArrowDownToLine className="h-3.5 w-3.5 text-red-500" /> Grid Import
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.gridPurchasedTodayEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.gridPurchasedTodayEnergyStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground sm:table-cell">
                      {(detail.gridPurchasedMonthEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.gridPurchasedMonthEnergyStr || "kWh"}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground md:table-cell">
                      {(detail.gridPurchasedYearEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.gridPurchasedYearEnergyStr || "kWh"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.gridPurchasedTotalEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.gridPurchasedTotalEnergyStr}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-500" /> Grid Export
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.gridSellTodayEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.gridSellTodayEnergyStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground sm:table-cell">
                      {(detail.gridSellMonthEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.gridSellMonthEnergyStr || "kWh"}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground md:table-cell">
                      {(detail.gridSellYearEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.gridSellYearEnergyStr || "kWh"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.gridSellTotalEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.gridSellTotalEnergyStr}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <BatteryCharging className="h-3.5 w-3.5 text-primary" /> Battery Charge
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.batteryTodayChargeEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.batteryTodayChargeEnergyStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground sm:table-cell">
                      {(detail.batteryMonthChargeEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.batteryMonthChargeEnergyStr || "kWh"}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground md:table-cell">
                      {(detail.batteryYearChargeEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.batteryYearChargeEnergyStr || "kWh"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.batteryTotalChargeEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.batteryTotalChargeEnergyStr}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <Battery className="h-3.5 w-3.5 text-primary" /> Battery Discharge
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.batteryTodayDischargeEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.batteryTodayDischargeEnergyStr}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground sm:table-cell">
                      {(detail.batteryMonthDischargeEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.batteryMonthDischargeEnergyStr || "kWh"}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-card-foreground md:table-cell">
                      {(detail.batteryYearDischargeEnergy ?? 0).toFixed(1)} <span className="text-muted-foreground">{detail.batteryYearDischargeEnergyStr || "kWh"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                      {detail.batteryTotalDischargeEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.batteryTotalDischargeEnergyStr}</span>
                    </td>
                  </tr>
                  {(detail.backupTodayEnergy || detail.backupTotalEnergy) ? (
                    <tr>
                      <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                        <PlugZap className="h-3.5 w-3.5 text-muted-foreground" /> Backup Load
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                        {detail.backupTodayEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.backupTodayEnergyStr}</span>
                      </td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">--</td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell">--</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-card-foreground">
                        {detail.backupTotalEnergy?.toFixed(1)} <span className="text-muted-foreground">{detail.backupTotalEnergyStr}</span>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DC/AC Readings */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Info className="h-4 w-4 text-muted-foreground" />
              DC Input (PV Strings)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => {
                const voltage = detail[`uPv${i}`] as number
                const current = detail[`iPv${i}`] as number
                const power = detail[`pow${i}`] as number
                if (!voltage && !current) return null
                return (
                  <div key={i} className="rounded-md border p-2.5">
                    <p className="text-xs font-medium text-muted-foreground">String {i}</p>
                    <p className="font-mono text-xs tabular-nums text-card-foreground">
                      {voltage?.toFixed(1) || 0} V
                    </p>
                    <p className="font-mono text-xs tabular-nums text-card-foreground">
                      {current?.toFixed(2) || 0} A
                    </p>
                    <p className="font-mono text-xs tabular-nums text-primary">
                      {power?.toFixed(0) || 0} W
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Info className="h-4 w-4 text-muted-foreground" />
              AC Output / Grid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              {[
                { label: "Phase R", v: detail.uAc1, i: detail.iAc1 },
                { label: "Phase S", v: detail.uAc2, i: detail.iAc2 },
                { label: "Phase T", v: detail.uAc3, i: detail.iAc3 },
              ].map((phase) => (
                <div key={phase.label} className="rounded-md border p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">{phase.label}</p>
                  <p className="font-mono text-xs tabular-nums text-card-foreground">
                    {phase.v?.toFixed(1) || 0} V
                  </p>
                  <p className="font-mono text-xs tabular-nums text-card-foreground">
                    {phase.i?.toFixed(2) || 0} A
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                Temp: {detail.inverterTemperature || 0}&deg;C
              </span>
              <span>Freq: {detail.fac || 0} {detail.facStr || "Hz"}</span>
              <span>Full Hours: {detail.fullHour?.toFixed(1) || 0}h</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Energy Production
            </CardTitle>
            <Tabs value={chartTab} onValueChange={setChartTab}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-3">
                  Today
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3">
                  Month
                </TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-3">
                  Year
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {chartTab === "day" && (
            <PowerChart data={dayData || []} />
          )}
          {chartTab === "month" && (
            <EnergyBarChart
              data={(monthData || []).map((d) => ({
                label: d.dateStr?.split("-")[2] || "",
                energy: d.energy,
                gridSell: d.gridSellEnergy,
                gridPurchased: d.gridPurchasedEnergy,
              }))}
              xLabel="Day"
            />
          )}
          {chartTab === "year" && (
            <EnergyBarChart
              data={(yearData || []).map((d) => ({
                label: d.dateStr?.split("-")[1] || "",
                energy: d.energy,
                gridSell: d.gridSellEnergy,
                gridPurchased: d.gridPurchasedEnergy,
              }))}
              xLabel="Month"
            />
          )}
        </CardContent>
      </Card>

      {/* Battery Details */}
      {detail.type === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
              <Battery className="h-4 w-4 text-muted-foreground" />
              Battery Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">SOC</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${detail.batteryCapacitySoc || 0}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-medium tabular-nums text-card-foreground">
                    {detail.batteryCapacitySoc?.toFixed(0) || 0}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SOH</p>
                <p className="font-medium tabular-nums text-card-foreground">
                  {detail.batteryHealthSoh?.toFixed(0) || 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Charged Today</p>
                <p className="font-medium tabular-nums text-card-foreground">
                  {detail.batteryTodayChargeEnergy?.toFixed(1) || 0} {detail.batteryTodayChargeEnergyStr || "kWh"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Discharged Today</p>
                <p className="font-medium tabular-nums text-card-foreground">
                  {detail.batteryTodayDischargeEnergy?.toFixed(1) || 0} {detail.batteryTodayDischargeEnergyStr || "kWh"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Charged</p>
                <p className="font-medium tabular-nums text-card-foreground">
                  {detail.batteryTotalChargeEnergy?.toFixed(1) || 0} {detail.batteryTotalChargeEnergyStr || "kWh"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Discharged</p>
                <p className="font-medium tabular-nums text-card-foreground">
                  {detail.batteryTotalDischargeEnergy?.toFixed(1) || 0} {detail.batteryTotalDischargeEnergyStr || "kWh"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
