"use client"

import { useState, useMemo } from "react"
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
} from "lucide-react"
import { useInverterDetail, useInverterDay, useInverterMonth, useInverterYear, getCurrencySettings, getTariffGroups, getExportPrice, toKWh } from "@/lib/solis-client"
import { PowerFlow } from "@/components/power-flow"
import { LoadShiftingCard } from "@/components/load-shifting-card"
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
  const [chartTab, setChartTab] = useState("month")

  const today = format(new Date(), "yyyy-MM-dd")
  const thisMonth = format(new Date(), "yyyy-MM")
  const thisYear = format(new Date(), "yyyy")

  const currency = useMemo(() => getCurrencySettings(), [])
  const exportRate = useMemo(() => getExportPrice(), [])
  const avgRate = useMemo(() => {
    const groups = getTariffGroups()
    // Weight each rate by the number of hours its slots cover
    let totalHours = 0
    let weightedSum = 0
    for (const g of groups) {
      if (g.rate <= 0) continue
      const slots = g.slots?.length ? g.slots : [{ startHour: g.startHour, endHour: g.endHour }]
      let hours = 0
      for (const s of slots) {
        hours += s.endHour > s.startHour ? s.endHour - s.startHour : (24 - s.startHour) + s.endHour
      }
      if (hours > 0) {
        weightedSum += g.rate * hours
        totalHours += hours
      }
    }
    if (totalHours > 0) return weightedSum / totalHours
    // Fallback: simple average
    const rates = groups.filter((g) => g.rate > 0).map((g) => g.rate)
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  }, [])

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

      {/* Power Flow + Summary — side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Power Flow Diagram — left half */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Live Power Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <PowerFlow detail={detail} />
          </CardContent>
        </Card>

        {/* Right column — stacked summary cards */}
        <div className="flex flex-col gap-4">
          {/* Energy Production */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Today</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-card-foreground">{(detail.eToday || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">{detail.eTodayStr || "kWh"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Month</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-card-foreground">{(detail.eMonth || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">{detail.eMonthStr || "kWh"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-card-foreground">{(detail.eTotal || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">{detail.eTotalStr || "MWh"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Self-Reliance & Self-Consumption + Value Savings */}
          {(() => {
            const produced = toKWh(detail.eToday, detail.eTodayStr)
            const exported = toKWh(detail.gridSellTodayEnergy, detail.gridSellTodayEnergyStr)
            const imported = toKWh(detail.gridPurchasedTodayEnergy, detail.gridPurchasedTodayEnergyStr)
            const consumed = toKWh(detail.homeLoadTodayEnergy, detail.homeLoadTodayEnergyStr)
            const battCharge = toKWh(detail.batteryTodayChargeEnergy, detail.batteryTodayChargeEnergyStr)
            const battDischarge = toKWh(detail.batteryTodayDischargeEnergy, detail.batteryTodayDischargeEnergyStr)

            // Solar energy used directly by home (not exported, not to battery)
            const solarDirectUse = Math.max(0, produced - exported - Math.max(0, battCharge - Math.max(0, imported - consumed + battDischarge)))
            // Simpler: self-supplied = min(consumed, solarDirectUse + battDischarge)
            const selfSupplied = Math.min(consumed, Math.max(0, produced - exported) + battDischarge)

            // Grid energy that actually went to the home (not to battery)
            const gridToHome = Math.max(0, consumed - selfSupplied)

            // Self-consumption: % of solar production kept (not exported)
            const clampedExport = Math.min(exported, produced)
            const selfConsumptionRate = produced > 0.01
              ? ((produced - clampedExport) / produced) * 100
              : 0

            // Self-reliance: % of consumption met by solar + battery (not grid)
            const selfRelianceRate = consumed > 0.01
              ? (selfSupplied / consumed) * 100
              : 0

            const valueSaved = avgRate > 0 ? selfSupplied * avgRate : 0
            const exportRevenue = exportRate > 0 ? clampedExport * exportRate : 0
            const gridCostToday = gridToHome * avgRate
            const netCostToday = gridCostToday - exportRevenue

            return (
              <>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
                        <p className="text-[10px] font-medium text-muted-foreground">Self-Reliance</p>
                        <p className="mt-0.5 text-2xl font-bold tabular-nums text-card-foreground">{selfRelianceRate.toFixed(0)}%</p>
                        <div className="mx-auto mt-1.5 h-1.5 w-full max-w-[120px] rounded-full bg-muted">
                          <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, selfRelianceRate)}%` }} />
                        </div>
                        <p className="mt-1 text-[9px] text-muted-foreground">of load met without grid</p>
                      </div>
                      <div className="text-center">
                        <Sun className="mx-auto mb-1 h-4 w-4 text-primary" />
                        <p className="text-[10px] font-medium text-muted-foreground">Self-Consumption</p>
                        <p className="mt-0.5 text-2xl font-bold tabular-nums text-card-foreground">{selfConsumptionRate.toFixed(0)}%</p>
                        <div className="mx-auto mt-1.5 h-1.5 w-full max-w-[120px] rounded-full bg-muted">
                          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, selfConsumptionRate)}%` }} />
                        </div>
                        <p className="mt-1 text-[9px] text-muted-foreground">of production used directly</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Value Savings + Cost Projection */}
                {avgRate > 0 && consumed > 0.01 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-md bg-emerald-500/5 p-2">
                          <p className="text-[10px] font-medium text-muted-foreground">Saved Today</p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{currency.symbol}{valueSaved.toFixed(2)}</p>
                          <p className="text-[9px] text-muted-foreground">{selfSupplied.toFixed(1)} kWh self-supplied</p>
                        </div>
                        <div className="rounded-md border p-2">
                          <p className="text-[10px] font-medium text-muted-foreground">Grid Cost</p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-card-foreground">{currency.symbol}{gridCostToday.toFixed(2)}</p>
                          <p className="text-[9px] text-muted-foreground">{gridToHome.toFixed(1)} kWh to home</p>
                        </div>
                        {exportRate > 0 ? (
                          <div className="rounded-md bg-emerald-500/5 p-2">
                            <p className="text-[10px] font-medium text-muted-foreground">Export Revenue</p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{currency.symbol}{exportRevenue.toFixed(2)}</p>
                            <p className="text-[9px] text-muted-foreground">{clampedExport.toFixed(1)} kWh exported</p>
                          </div>
                        ) : (
                          <div className="rounded-md border p-2">
                            <p className="text-[10px] font-medium text-muted-foreground">Without Solar</p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-muted-foreground line-through">{currency.symbol}{(consumed * avgRate).toFixed(2)}</p>
                            <p className="text-[9px] text-muted-foreground">{consumed.toFixed(1)} kWh from grid</p>
                          </div>
                        )}
                      </div>

                      {/* Projected electricity cost based on month data */}
                      {(() => {
                        const days = monthData || []
                        const numDays = days.length
                        if (numDays < 1 || avgRate <= 0) return null

                        // Sum import cost and export revenue across all days in the month
                        let totalImportCost = 0
                        let totalExportRev = 0
                        for (const d of days) {
                          totalImportCost += (d.gridPurchasedEnergy || 0) * avgRate
                          totalExportRev += (d.gridSellEnergy || 0) * exportRate
                        }

                        const totalNetCost = totalImportCost - totalExportRev
                        const avgDailyCost = totalNetCost / numDays

                        return (
                          <div className="border-t pt-3">
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Estimated Electricity Cost</p>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Daily Avg</p>
                                <p className="text-base font-bold tabular-nums text-card-foreground">{currency.symbol}{avgDailyCost.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Weekly</p>
                                <p className="text-base font-bold tabular-nums text-card-foreground">{currency.symbol}{(avgDailyCost * 7).toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Monthly</p>
                                <p className="text-base font-bold tabular-nums text-card-foreground">{currency.symbol}{totalNetCost.toFixed(2)}</p>
                              </div>
                            </div>
                            <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
                              Based on {numDays} day{numDays !== 1 ? "s" : ""} of data this month{exportRate > 0 ? " (net of export revenue)" : ""}
                            </p>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                )}
              </>
            )
          })()}

          {/* Today's power curve — fills remaining space */}
          <Card className="flex-1">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold text-card-foreground">Today{"'"}s Power</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <PowerChart data={dayData || []} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Energy Flow Breakdown */}
      {(() => {
        // Helper: normalise to kWh and format with appropriate unit for display
        const e = (val: number | undefined, unitStr: string | undefined) => {
          const kwh = toKWh(val, unitStr)
          if (kwh >= 1000) return { text: (kwh / 1000).toFixed(2), unit: "MWh" }
          return { text: kwh.toFixed(1), unit: "kWh" }
        }
        // Compute week totals from last 7 days of monthData (already in kWh)
        const sorted7 = [...(monthData || [])].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 7)
        const wk = {
          production: sorted7.reduce((s, d) => s + (d.energy || 0), 0),
          consumption: sorted7.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
          gridImport: sorted7.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0),
          gridExport: sorted7.reduce((s, d) => s + (d.gridSellEnergy || 0), 0),
          battCharge: sorted7.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
          battDischarge: sorted7.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
        }
        const fmtWk = (v: number) => v >= 1000 ? { text: (v / 1000).toFixed(2), unit: "MWh" } : { text: v.toFixed(1), unit: "kWh" }
        const thHidden = "hidden px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
        const tdHidden = "hidden px-3 py-2.5 text-right tabular-nums text-card-foreground"
        const ECell = ({ v, u, cls }: { v: number | undefined; u: string | undefined; cls: string }) => {
          const f = e(v, u)
          return <td className={cls}>{f.text} <span className="text-muted-foreground">{f.unit}</span></td>
        }
        const WkCell = ({ v, cls }: { v: number; cls: string }) => {
          const f = fmtWk(v)
          return <td className={cls}>{f.text} <span className="text-muted-foreground">{f.unit}</span></td>
        }
        return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Leaf className="h-4 w-4 text-emerald-500" />
            Energy Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Metric</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Today</th>
                    <th className={`${thHidden} sm:table-cell`}>Week</th>
                    <th className={`${thHidden} sm:table-cell`}>Month</th>
                    <th className={`${thHidden} md:table-cell`}>Year</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <Sun className="h-3.5 w-3.5 text-primary" /> Production
                    </td>
                    <ECell v={detail.eToday} u={detail.eTodayStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    <WkCell v={wk.production} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.eMonth} u={detail.eMonthStr} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.eYear} u={detail.eYearStr} cls={`${tdHidden} md:table-cell`} />
                    <ECell v={detail.eTotal} u={detail.eTotalStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <Home className="h-3.5 w-3.5 text-muted-foreground" /> Consumption
                    </td>
                    <ECell v={detail.homeLoadTodayEnergy} u={detail.homeLoadTodayEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    <WkCell v={wk.consumption} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.homeLoadMonthEnergy} u={detail.homeLoadMonthEnergyStr || "kWh"} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.homeLoadYearEnergy} u={detail.homeLoadYearEnergyStr || "kWh"} cls={`${tdHidden} md:table-cell`} />
                    <ECell v={detail.homeLoadTotalEnergy} u={detail.homeLoadTotalEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <ArrowDownToLine className="h-3.5 w-3.5 text-red-500" /> Grid Import
                    </td>
                    <ECell v={detail.gridPurchasedTodayEnergy} u={detail.gridPurchasedTodayEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    <WkCell v={wk.gridImport} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.gridPurchasedMonthEnergy} u={detail.gridPurchasedMonthEnergyStr || "kWh"} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.gridPurchasedYearEnergy} u={detail.gridPurchasedYearEnergyStr || "kWh"} cls={`${tdHidden} md:table-cell`} />
                    <ECell v={detail.gridPurchasedTotalEnergy} u={detail.gridPurchasedTotalEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                  </tr>
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-500" /> Grid Export
                    </td>
                    <ECell v={detail.gridSellTodayEnergy} u={detail.gridSellTodayEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    <WkCell v={wk.gridExport} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.gridSellMonthEnergy} u={detail.gridSellMonthEnergyStr || "kWh"} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.gridSellYearEnergy} u={detail.gridSellYearEnergyStr || "kWh"} cls={`${tdHidden} md:table-cell`} />
                    <ECell v={detail.gridSellTotalEnergy} u={detail.gridSellTotalEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                  </tr>
                  {(detail.batteryTodayChargeEnergy || detail.batteryTotalChargeEnergy) ? (
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <BatteryCharging className="h-3.5 w-3.5 text-primary" /> Battery Charge
                    </td>
                    <ECell v={detail.batteryTodayChargeEnergy} u={detail.batteryTodayChargeEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    <WkCell v={wk.battCharge} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.batteryMonthChargeEnergy} u={detail.batteryMonthChargeEnergyStr || "kWh"} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.batteryYearChargeEnergy} u={detail.batteryYearChargeEnergyStr || "kWh"} cls={`${tdHidden} md:table-cell`} />
                    <ECell v={detail.batteryTotalChargeEnergy} u={detail.batteryTotalChargeEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                  </tr>
                  ) : null}
                  {(detail.batteryTodayDischargeEnergy || detail.batteryTotalDischargeEnergy) ? (
                  <tr>
                    <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                      <Battery className="h-3.5 w-3.5 text-primary" /> Battery Discharge
                    </td>
                    <ECell v={detail.batteryTodayDischargeEnergy} u={detail.batteryTodayDischargeEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    <WkCell v={wk.battDischarge} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.batteryMonthDischargeEnergy} u={detail.batteryMonthDischargeEnergyStr || "kWh"} cls={`${tdHidden} sm:table-cell`} />
                    <ECell v={detail.batteryYearDischargeEnergy} u={detail.batteryYearDischargeEnergyStr || "kWh"} cls={`${tdHidden} md:table-cell`} />
                    <ECell v={detail.batteryTotalDischargeEnergy} u={detail.batteryTotalDischargeEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                  </tr>
                  ) : null}
                  {(detail.backupTodayEnergy || detail.backupTotalEnergy) ? (
                    <tr>
                      <td className="flex items-center gap-2 px-3 py-2.5 font-medium text-card-foreground">
                        <PlugZap className="h-3.5 w-3.5 text-muted-foreground" /> Backup Load
                      </td>
                      <ECell v={detail.backupTodayEnergy} u={detail.backupTodayEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                      <td className={`${tdHidden} sm:table-cell`}>--</td>
                      <td className={`${tdHidden} sm:table-cell`}>--</td>
                      <td className={`${tdHidden} md:table-cell`}>--</td>
                      <ECell v={detail.backupTotalEnergy} u={detail.backupTotalEnergyStr} cls="px-3 py-2.5 text-right tabular-nums text-card-foreground" />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
      </Card>
        )
      })()}

      {/* Load Shifting Analysis */}
      {dayData && dayData.length > 0 && (
        <LoadShiftingCard detail={detail} dayData={dayData} monthData={monthData} yearData={yearData} />
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

      {/* Energy History Charts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Energy History
            </CardTitle>
            <Tabs value={chartTab} onValueChange={setChartTab}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs px-3">
                  This Month
                </TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-3">
                  This Year
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
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
