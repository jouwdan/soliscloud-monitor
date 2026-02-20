"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Sun,
  Battery,
  Thermometer,
  Clock,
  AlertTriangle,
  Info,
  ShieldCheck,
} from "lucide-react"
import { useInverterDetail, useInverterDay, useInverterMonth, useInverterYear, computeTOUCost, getCurrencySettings, getTariffGroups, getExportPrice, pickGridPower, pickGridPowerPec, toKWh, getTariffForHour, toKW, type InverterDayEntry } from "@/lib/solis-client"
import { PowerFlow } from "@/components/power-flow"
import { LoadShiftingCard } from "@/components/load-shifting-card"
import { StatusBadge } from "@/components/status-badge"
import { PowerChart } from "@/components/power-chart"
import { EnergyBarChart } from "@/components/energy-bar-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

interface InverterDetailViewProps {
  id: string
  sn: string
}

export function InverterDetailView({ id, sn }: InverterDetailViewProps) {
  const { data: detail, error, isLoading } = useInverterDetail(id, sn)
  const [powerTab, setPowerTab] = useState("today")

  const today = format(new Date(), "yyyy-MM-dd")
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd")
  const thisMonth = format(new Date(), "yyyy-MM")
  const prevMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), "yyyy-MM")
  const dayOfMonth = new Date().getDate()
  const thisYear = format(new Date(), "yyyy")

  const currency = useMemo(() => getCurrencySettings(), [])
  const exportRate = useMemo(() => getExportPrice(), [])
  const tariffGroups = useMemo(() => getTariffGroups(), [])
  const hasRates = tariffGroups.some((g) => g.rate > 0)


  const tz = useMemo(() => String(Math.round(-new Date().getTimezoneOffset() / 60)), [])
  const { data: dayData } = useInverterDay(id, sn, today, tz)
  const { data: yesterdayData } = useInverterDay(
    powerTab === "yesterday" ? id : "",
    sn,
    yesterday,
    tz,
  )
  const { data: monthData } = useInverterMonth(id, sn, thisMonth)
  // Fetch previous month when "7 Days" tab is active and we're in the first 7 days
  const needsPrevMonth = powerTab === "week" && dayOfMonth < 7
  const { data: prevMonthData } = useInverterMonth(needsPrevMonth ? id : "", sn, prevMonth)
  const { data: yearData } = useInverterYear(id, sn, thisYear)
  // Lifetime tab: fetch up to 4 previous years (conditional on tab)
  const isLifetime = powerTab === "lifetime"
  const yr = parseInt(thisYear, 10)
  const { data: yearDataM1 } = useInverterYear(isLifetime ? id : "", sn, String(yr - 1))
  const { data: yearDataM2 } = useInverterYear(isLifetime ? id : "", sn, String(yr - 2))
  const { data: yearDataM3 } = useInverterYear(isLifetime ? id : "", sn, String(yr - 3))
  const { data: yearDataM4 } = useInverterYear(isLifetime ? id : "", sn, String(yr - 4))

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
              <p className="font-medium text-card-foreground">{detail.type === 2 || detail.batteryCapacitySoc > 0 ? "Storage" : "Grid-tied"}</p>
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

      {/* Power Flow + Stats — responsive row on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* Power Flow Diagram — compact */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Live Power Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <PowerFlow detail={detail} />
          </CardContent>
        </Card>

        {/* Right side — key stats stacked */}
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

          {/* Self-Reliance & Self-Consumption */}
          {(() => {
            const produced = toKWh(detail.eToday, detail.eTodayStr)
            const exported = toKWh(detail.gridSellTodayEnergy, detail.gridSellTodayEnergyStr)
            const imported = toKWh(detail.gridPurchasedTodayEnergy, detail.gridPurchasedTodayEnergyStr)
            const consumed = toKWh(detail.homeLoadTodayEnergy, detail.homeLoadTodayEnergyStr)
            const battDischarge = toKWh(detail.batteryTodayDischargeEnergy, detail.batteryTodayDischargeEnergyStr)

            const selfSupplied = Math.min(consumed, Math.max(0, produced - exported) + battDischarge)
            const gridToHome = Math.max(0, consumed - selfSupplied)
            const clampedExport = Math.min(exported, produced)
            const selfConsumptionRate = produced > 0.01
              ? ((produced - clampedExport) / produced) * 100
              : 0
            const selfRelianceRate = consumed > 0.01
              ? (selfSupplied / consumed) * 100
              : 0

            const touToday = useMemo(() => computeTOUCost(dayData || [], imported, exported, consumed, tariffGroups, exportRate), [dayData, imported, exported, consumed, tariffGroups, exportRate])
            const gridCostToday = touToday.gridCost
            const exportRevenue = touToday.exportRev
            const fullGridCost = touToday.fullGridCost
            const valueSaved = Math.max(0, fullGridCost - gridCostToday)

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
                    {detail.homeLoadYesterdayEnergy > 0 && (() => {
                      const yesterdayLoad = toKWh(detail.homeLoadYesterdayEnergy, detail.homeLoadYesterdayEnergyStr)
                      const delta = consumed - yesterdayLoad
                      return (
                        <div className="mt-2 pt-2 border-t text-center text-xs text-muted-foreground">
                          Yesterday&apos;s load: {yesterdayLoad.toFixed(1)} kWh
                          {consumed > 0.01 && (
                            <span className={delta > 0 ? "text-red-400 ml-1" : "text-emerald-400 ml-1"}>
                              ({delta > 0 ? "+" : ""}{delta.toFixed(1)} kWh today)
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>

                {hasRates && consumed > 0.01 && (
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
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-muted-foreground line-through">{currency.symbol}{fullGridCost.toFixed(2)}</p>
                            <p className="text-[9px] text-muted-foreground">{consumed.toFixed(1)} kWh from grid</p>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const days = monthData || []
                        const numDays = days.length
                        if (numDays < 1 || !hasRates) return null

                        const todayImported = toKWh(detail.gridPurchasedTodayEnergy, detail.gridPurchasedTodayEnergyStr)
                        const touEffectiveRate = todayImported > 0.1 ? touToday.gridCost / todayImported : (() => {
                          let tH = 0, wS = 0
                          for (const g of tariffGroups) {
                            if (g.rate <= 0) continue
                            const sl = g.slots?.length ? g.slots : [{ startHour: g.startHour, endHour: g.endHour }]
                            let h = 0
                            for (const s of sl) h += s.endHour > s.startHour ? s.endHour - s.startHour : (24 - s.startHour) + s.endHour
                            if (h > 0) { wS += g.rate * h; tH += h }
                          }
                          return tH > 0 ? wS / tH : 0
                        })()

                        let totalImportCost = 0
                        let totalExportRev = 0
                        for (const d of days) {
                          totalImportCost += (d.gridPurchasedEnergy || 0) * touEffectiveRate
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
        </div>
      </div>

      {/* Power Chart — full width with period tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold text-card-foreground">Power</CardTitle>
            <Tabs value={powerTab} onValueChange={setPowerTab}>
              <TabsList className="h-8">
                <TabsTrigger value="today" className="text-xs px-2.5">Today</TabsTrigger>
                <TabsTrigger value="yesterday" className="text-xs px-2.5">Yesterday</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5">7 Days</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5">Month</TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-2.5">Year</TabsTrigger>
                <TabsTrigger value="lifetime" className="text-xs px-2.5">Lifetime</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {powerTab === "today" && <PowerChart data={dayData || []} />}
          {powerTab === "yesterday" && <PowerChart data={yesterdayData || []} />}
          {powerTab === "week" && (() => {
            // Merge previous month + current month so the 7-day window spans month boundaries
            const combined = [...(prevMonthData || []), ...(monthData || [])]
              .sort((a, b) => (a.date || 0) - (b.date || 0))
              .slice(-7)
            return (
              <EnergyBarChart
                data={combined.map((d) => ({
                  label: d.dateStr
                    ? new Date(d.dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
                    : "",
                  energy: d.energy,
                  gridSell: d.gridSellEnergy,
                  gridPurchased: d.gridPurchasedEnergy,
                  homeLoad: d.homeLoadEnergy,
                  batteryCharge: d.batteryChargeEnergy,
                  batteryDischarge: d.batteryDischargeEnergy,
                }))}
                xLabel="Day"
              />
            )
          })()}
          {powerTab === "month" && (
            <EnergyBarChart
              data={(monthData || []).map((d) => ({
                label: d.dateStr?.split("-")[2] || "",
                energy: d.energy,
                gridSell: d.gridSellEnergy,
                gridPurchased: d.gridPurchasedEnergy,
                homeLoad: d.homeLoadEnergy,
                batteryCharge: d.batteryChargeEnergy,
                batteryDischarge: d.batteryDischargeEnergy,
              }))}
              xLabel="Day"
            />
          )}
          {powerTab === "year" && (
            <EnergyBarChart
              data={(yearData || []).map((d) => {
                const monthNum = d.dateStr?.split("-")[1] || ""
                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                const label = monthNames[parseInt(monthNum, 10) - 1] || monthNum
                return {
                  label,
                  energy: d.energy,
                  gridSell: d.gridSellEnergy,
                  gridPurchased: d.gridPurchasedEnergy,
                  homeLoad: d.homeLoadEnergy,
                  batteryCharge: d.batteryChargeEnergy,
                  batteryDischarge: d.batteryDischargeEnergy,
                }
              })}
              xLabel="Month"
            />
          )}
          {powerTab === "lifetime" && (() => {
            // Aggregate each year's monthly entries into yearly totals
            const allYears: [number, typeof yearData][] = [
              [yr - 4, yearDataM4],
              [yr - 3, yearDataM3],
              [yr - 2, yearDataM2],
              [yr - 1, yearDataM1],
              [yr, yearData],
            ]
            const yearlyBars = allYears
              .filter(([, d]) => d && d.length > 0)
              .map(([y, d]) => ({
                label: String(y),
                energy: d!.reduce((s, m) => s + (m.energy || 0), 0),
                homeLoad: d!.reduce((s, m) => s + (m.homeLoadEnergy || 0), 0),
                gridPurchased: d!.reduce((s, m) => s + (m.gridPurchasedEnergy || 0), 0),
                gridSell: d!.reduce((s, m) => s + (m.gridSellEnergy || 0), 0),
                batteryCharge: d!.reduce((s, m) => s + (m.batteryChargeEnergy || 0), 0),
                batteryDischarge: d!.reduce((s, m) => s + (m.batteryDischargeEnergy || 0), 0),
              }))
            const firstYear = yearlyBars.length > 0 ? yearlyBars[0].label : thisYear

            // Lifetime totals from detail endpoint
            const fmtE = (v: number | undefined, u: string | undefined) => {
              const kwh = toKWh(v, u)
              if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`
              return `${kwh.toFixed(1)} kWh`
            }

            return (
              <div className="space-y-3">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 text-center text-xs sm:grid-cols-6">
                  <div>
                    <p className="text-muted-foreground">Generation</p>
                    <p className="font-medium tabular-nums text-card-foreground">{fmtE(detail.eTotal, detail.eTotalStr)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Consumption</p>
                    <p className="font-medium tabular-nums text-card-foreground">{fmtE(detail.homeLoadTotalEnergy, detail.homeLoadTotalEnergyStr)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Grid Import</p>
                    <p className="font-medium tabular-nums text-card-foreground">{fmtE(detail.gridPurchasedTotalEnergy, detail.gridPurchasedTotalEnergyStr)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Grid Export</p>
                    <p className="font-medium tabular-nums text-card-foreground">{fmtE(detail.gridSellTotalEnergy, detail.gridSellTotalEnergyStr)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Batt Charge</p>
                    <p className="font-medium tabular-nums text-card-foreground">{fmtE(detail.batteryTotalChargeEnergy, detail.batteryTotalChargeEnergyStr)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Batt Discharge</p>
                    <p className="font-medium tabular-nums text-card-foreground">{fmtE(detail.batteryTotalDischargeEnergy, detail.batteryTotalDischargeEnergyStr)}</p>
                  </div>
                </div>
                <p className="text-center text-[10px] text-muted-foreground">
                  {firstYear} &ndash; {thisYear} &middot; {detail.fullHour?.toFixed(0) || 0} operating hours
                </p>
                {/* Yearly bar chart */}
                {yearlyBars.length > 0 && (
                  <EnergyBarChart data={yearlyBars} xLabel="Year" />
                )}
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Load Shifting Analysis */}
      {dayData && dayData.length > 0 && (
        <LoadShiftingCard detail={detail} dayData={dayData} monthData={monthData} yearData={yearData} />
      )}

      {/* Battery Details — show when inverter is storage type or has battery data */}
      {(detail.type === 2 || detail.batteryCapacitySoc > 0 || detail.batteryTodayChargeEnergy > 0) && (
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
              {(() => {
                const ext = detail as Record<string, unknown>
                const dischFloor = ext.socDischargeSet as number | undefined
                const epsReserve = ext.epsDDepth as number | undefined
                const backupV = ext.bypassAcVoltage as number | undefined
                const showBackup = ext.backupShow === 1
                if (!dischFloor && !epsReserve && !showBackup) return null
                return (
                  <>
                    {dischFloor != null && dischFloor > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Min SOC (Grid)</p>
                        <p className="font-medium tabular-nums text-card-foreground">{dischFloor}%</p>
                        <p className="text-[9px] text-muted-foreground">daily discharge floor</p>
                      </div>
                    )}
                    {showBackup && epsReserve != null && epsReserve > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Min SOC (Backup)</p>
                        <p className="font-medium tabular-nums text-card-foreground">{epsReserve}%</p>
                        <p className="text-[9px] text-muted-foreground">reserve during outage</p>
                      </div>
                    )}
                    {showBackup && backupV != null && backupV > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Backup Voltage</p>
                        <p className="font-medium tabular-nums text-card-foreground">{backupV.toFixed(1)} V</p>
                      </div>
                    )}
                  </>
                )
              })()}
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
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                Temp: {detail.inverterTemperature || 0}&deg;C
              </span>
              <span>Freq: {detail.fac || 0} {detail.facStr || "Hz"}</span>
              <span>Full Hours: {detail.fullHour?.toFixed(1) || 0}h</span>
              {detail.apparentPower > 0 && (() => {
                const pacKW = toKW(detail.pac, detail.pacStr)
                const appKVA = toKW(detail.apparentPower, detail.apparentPowerStr)
                const pf = appKVA > 0 ? Math.abs(pacKW) / appKVA : 0
                return (
                  <>
                    <span>PF: {Math.min(1, pf).toFixed(2)}</span>
                    <span>Apparent: {detail.apparentPower} {detail.apparentPowerStr || "kVA"}</span>
                  </>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generator — only if supported */}
      {((detail as Record<string, unknown>).generatorSupport === 1 || detail.generatorTotalEnergy > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Info className="h-4 w-4 text-muted-foreground" />
              Generator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm text-center">
              <div>
                <p className="text-xs text-muted-foreground">Power</p>
                <p className="font-medium tabular-nums text-card-foreground">{detail.generatorPower?.toFixed(2) || 0} {detail.generatorPowerStr || "kW"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="font-medium tabular-nums text-card-foreground">{detail.generatorTodayEnergy?.toFixed(1) || 0} {detail.generatorTodayEnergyStr || "kWh"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-medium tabular-nums text-card-foreground">{detail.generatorTotalEnergy?.toFixed(1) || 0} {detail.generatorTotalEnergyStr || "kWh"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup Energy — only if an outage has occurred */}
      {detail.backupTotalEnergy > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Backup Energy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm text-center">
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="font-medium tabular-nums text-card-foreground">{detail.backupTodayEnergy?.toFixed(1) || 0} {detail.backupTodayEnergyStr || "kWh"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-medium tabular-nums text-card-foreground">{detail.backupTotalEnergy?.toFixed(1) || 0} {detail.backupTotalEnergyStr || "kWh"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
