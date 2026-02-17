"use client"

import { useMemo, useState } from "react"
import {
  Moon,
  Sun,
  ArrowDownToLine,
  Battery,
  TrendingUp,
  Info,
  Coins,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getOffPeakSettings,
  isOffPeakHour,
  getTariffGroups,
  getTariffSlots,
  getRateForHour,
  getCurrencySettings,
  getExportPrice,
  toKW,
  type InverterDayEntry,
  type InverterDetail,
  type InverterMonthEntry,
  type InverterYearEntry,
  type OffPeakSettings,
  type TariffGroup,
  type CurrencySettings,
} from "@/lib/solis-client"

interface LoadShiftingCardProps {
  detail: InverterDetail
  dayData: InverterDayEntry[]
  monthData?: InverterMonthEntry[]
  yearData?: InverterYearEntry[]
}

interface TariffBreakdown {
  group: TariffGroup
  gridImport: number
  consumption: number
  cost: number
}

interface LoadShiftingAnalysis {
  offPeakGridImport: number
  peakGridImport: number
  offPeakBatteryCharge: number
  peakBatteryDischarge: number
  peakSolarDirect: number
  offPeakConsumption: number
  peakConsumption: number
  totalConsumption: number
  loadShiftedEnergy: number
  loadShiftEfficiency: number
  settings: OffPeakSettings
  offPeakPoints: number
  peakPoints: number
  tariffBreakdown: TariffBreakdown[]
  totalGridCost: number
  shiftedSavings: number
  hasRates: boolean
  offPeakGridCost: number
  peakGridCost: number
  gridExportRevenue: number
  netCost: number
  costWithoutSolar: number
}

function analyzeLoadShifting(
  dayData: InverterDayEntry[],
  settings: OffPeakSettings,
  tariffGroups: TariffGroup[]
): LoadShiftingAnalysis {
  let offPeakGridImport = 0
  let peakGridImport = 0
  let offPeakBatteryCharge = 0
  let peakBatteryDischarge = 0
  let peakSolarDirect = 0
  let offPeakConsumption = 0
  let peakConsumption = 0
  let offPeakPoints = 0
  let peakPoints = 0
  let offPeakGridCost = 0
  let peakGridCost = 0
  let gridExportRevenue = 0
  let totalLoadEnergy = 0
  const feedInRate = getExportPrice()

  // Per-tariff-group accumulators
  const groupAccum = new Map<string, { gridImport: number; consumption: number; cost: number }>()
  for (const g of tariffGroups) {
    groupAccum.set(g.id, { gridImport: 0, consumption: 0, cost: 0 })
  }

  const sorted = [...dayData].sort(
    (a, b) => Number(a.dataTimestamp) - Number(b.dataTimestamp)
  )

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    let ts = Number(entry.dataTimestamp)
    // Normalise timestamp: if it looks like seconds (< 1e12), convert to ms
    if (ts > 0 && ts < 1e12) ts = ts * 1000
    const date = new Date(ts)
    const hour = date.getHours()
    const offPeak = isOffPeakHour(hour, settings)

    let intervalHours = 5 / 60
    if (i > 0) {
      let prev = Number(sorted[i - 1].dataTimestamp)
      if (prev > 0 && prev < 1e12) prev = prev * 1000
      const diff = (ts - prev) / (1000 * 60 * 60)
      if (diff > 0 && diff < 1) intervalHours = diff
    }

    // Normalise all power readings to kW
    // Use pacPec as shared fallback since Solis day entries use the same scale for all fields
    const raw = entry as Record<string, unknown>
    const sharedPec = entry.pacPec
    const gridPec = (raw.psumPec ?? raw.psumCalPec ?? raw.pSumPec ?? sharedPec) as string | undefined
    const gridPower = toKW(entry.pSum, entry.pSumStr, gridPec)
    const battPower = toKW(entry.batteryPower, entry.batteryPowerStr, (entry.batteryPowerPec ?? sharedPec) as string | undefined)
    const solarPower = toKW(entry.pac, entry.pacStr, entry.pacPec)
    const loadPower = toKW(entry.familyLoadPower, entry.familyLoadPowerStr, (entry.familyLoadPowerPec ?? sharedPec) as string | undefined)

    // Accumulate per-tariff-group
    const rate = getRateForHour(hour, tariffGroups)
    const matchedGroup = tariffGroups.find((g) => {
      if (g.startHour > g.endHour) return hour >= g.startHour || hour < g.endHour
      return hour >= g.startHour && hour < g.endHour
    })
    if (matchedGroup) {
      const acc = groupAccum.get(matchedGroup.id)!
      const imported = gridPower > 0 ? gridPower * intervalHours : 0
      acc.gridImport += imported
      acc.consumption += loadPower * intervalHours
      acc.cost += imported * rate // rate is in currency/kWh as entered by user
    }

    // Track total load for "without solar" cost
    totalLoadEnergy += loadPower * intervalHours

    // Track grid export revenue (negative pSum = exporting) using the export/feed-in tariff
    if (gridPower < 0 && feedInRate > 0) {
      gridExportRevenue += Math.abs(gridPower) * intervalHours * feedInRate
    }

    if (offPeak) {
      offPeakPoints++
      if (gridPower > 0) {
        offPeakGridImport += gridPower * intervalHours
        offPeakGridCost += gridPower * intervalHours * rate
      }
      if (battPower > 0) offPeakBatteryCharge += battPower * intervalHours
      offPeakConsumption += loadPower * intervalHours
    } else {
      peakPoints++
      if (gridPower > 0) {
        peakGridImport += gridPower * intervalHours
        peakGridCost += gridPower * intervalHours * rate
      }
      if (battPower < 0) peakBatteryDischarge += Math.abs(battPower) * intervalHours
      if (solarPower > 0) peakSolarDirect += solarPower * intervalHours
      peakConsumption += loadPower * intervalHours
    }
  }

  const totalConsumption = offPeakConsumption + peakConsumption
  const loadShiftedEnergy = Math.min(offPeakBatteryCharge, peakBatteryDischarge)
  const loadShiftEfficiency =
    peakConsumption > 0
      ? Math.min(100, ((peakBatteryDischarge + peakSolarDirect) / peakConsumption) * 100)
      : 0

  const hasRates = tariffGroups.some((g) => g.rate > 0)
  const tariffBreakdown: TariffBreakdown[] = tariffGroups
    .map((g) => {
      const acc = groupAccum.get(g.id)!
      return { group: g, ...acc }
    })
    .filter((b) => b.gridImport > 0.001 || b.consumption > 0.001)

  const totalGridCost = tariffBreakdown.reduce((sum, b) => sum + b.cost, 0)

  // Savings: energy shifted * (highest rate - lowest rate)
  const rates = tariffGroups.filter((g) => g.rate > 0).map((g) => g.rate)
  const maxRate = rates.length > 0 ? Math.max(...rates) : 0
  const minRate = rates.length > 0 ? Math.min(...rates) : 0
  const shiftedSavings = hasRates ? loadShiftedEnergy * (maxRate - minRate) : 0

  // What it would cost if ALL consumption came from grid at avg weighted rate
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  const costWithoutSolar = totalLoadEnergy * avgRate
  const netCost = totalGridCost - gridExportRevenue

  return {
    offPeakGridImport,
    peakGridImport,
    offPeakBatteryCharge,
    peakBatteryDischarge,
    peakSolarDirect,
    offPeakConsumption,
    peakConsumption,
    totalConsumption,
    loadShiftedEnergy,
    loadShiftEfficiency,
    settings,
    offPeakPoints,
    peakPoints,
    tariffBreakdown,
    totalGridCost,
    shiftedSavings,
    hasRates,
    offPeakGridCost,
    peakGridCost,
    gridExportRevenue,
    netCost,
    costWithoutSolar,
  }
}

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}${period}`
}

type Period = "day" | "week" | "month" | "year" | "lifetime"

interface PeriodSummary {
  label: string
  gridImport: number
  gridExport: number
  gridImportCost: number
  gridExportRevenue: number
  netCost: number
  consumption: number
  production: number
  batteryCharge: number
  batteryDischarge: number
  days: number
}

function computePeriodSummaries(
  detail: InverterDetail,
  monthData: InverterMonthEntry[],
  yearData: InverterYearEntry[],
  avgRate: number,
  exportRate: number,
): Record<Period, PeriodSummary> {
  // Day
  const dayImport = detail.gridPurchasedTodayEnergy || 0
  const dayExport = detail.gridSellTodayEnergy || 0
  const dayImportCost = dayImport * avgRate
  const dayExportRev = dayExport * exportRate

  // Week (last 7 days from month data)
  const sorted = [...monthData].sort((a, b) => (b.date || 0) - (a.date || 0))
  const weekDays = sorted.slice(0, 7)
  const weekImport = weekDays.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0)
  const weekExport = weekDays.reduce((s, d) => s + (d.gridSellEnergy || 0), 0)

  // Month
  const monthImport = detail.gridPurchasedMonthEnergy ?? monthData.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0)
  const monthExport = detail.gridSellMonthEnergy ?? monthData.reduce((s, d) => s + (d.gridSellEnergy || 0), 0)

  // Year
  const yearImport = detail.gridPurchasedYearEnergy ?? yearData.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0)
  const yearExport = detail.gridSellYearEnergy ?? yearData.reduce((s, d) => s + (d.gridSellEnergy || 0), 0)

  // Lifetime
  const totalImport = detail.gridPurchasedTotalEnergy || 0
  const totalExport = detail.gridSellTotalEnergy || 0

  const make = (label: string, imp: number, exp: number, prod: number, cons: number, battC: number, battD: number, days: number): PeriodSummary => ({
    label,
    gridImport: imp,
    gridExport: exp,
    gridImportCost: imp * avgRate,
    gridExportRevenue: exp * exportRate,
    netCost: imp * avgRate - exp * exportRate,
    consumption: cons,
    production: prod,
    batteryCharge: battC,
    batteryDischarge: battD,
    days,
  })

  return {
    day: make("Today", dayImport, dayExport,
      detail.eToday || 0, detail.homeLoadTodayEnergy || 0,
      detail.batteryTodayChargeEnergy || 0, detail.batteryTodayDischargeEnergy || 0, 1),
    week: make("This Week", weekImport, weekExport,
      weekDays.reduce((s, d) => s + (d.energy || 0), 0),
      weekDays.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
      weekDays.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
      weekDays.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
      weekDays.length),
    month: make("This Month", monthImport, monthExport,
      detail.eMonth || 0, detail.homeLoadMonthEnergy ?? monthData.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
      detail.batteryMonthChargeEnergy ?? monthData.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
      detail.batteryMonthDischargeEnergy ?? monthData.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
      monthData.length || 30),
    year: make("This Year", yearImport, yearExport,
      detail.eYear || 0, detail.homeLoadYearEnergy ?? yearData.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
      detail.batteryYearChargeEnergy ?? yearData.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
      detail.batteryYearDischargeEnergy ?? yearData.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
      yearData.length || 365),
    lifetime: make("Lifetime", totalImport, totalExport,
      detail.eTotal || 0, detail.homeLoadTotalEnergy || 0,
      detail.batteryTotalChargeEnergy || 0, detail.batteryTotalDischargeEnergy || 0, 0),
  }
}

export function LoadShiftingCard({ detail, dayData, monthData, yearData }: LoadShiftingCardProps) {
  const currency = useMemo(() => getCurrencySettings(), [])
  const [period, setPeriod] = useState<Period>("day")

  const analysis = useMemo(() => {
    const settings = getOffPeakSettings()
    const groups = getTariffGroups()
    return analyzeLoadShifting(dayData, settings, groups)
  }, [dayData])

  const tariffGroups = useMemo(() => getTariffGroups(), [])
  const avgRate = useMemo(() => {
    const rates = tariffGroups.filter((g) => g.rate > 0).map((g) => g.rate)
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  }, [tariffGroups])
  const exportRate = useMemo(() => getExportPrice(), [])

  const summaries = useMemo(
    () => computePeriodSummaries(detail, monthData || [], yearData || [], avgRate, exportRate),
    [detail, monthData, yearData, avgRate, exportRate]
  )
  const currentSummary = summaries[period]

  const hasData = analysis.offPeakPoints > 0 || analysis.peakPoints > 0
  const hasBattery =
    detail.batteryTodayChargeEnergy > 0 ||
    detail.batteryTodayDischargeEnergy > 0 ||
    analysis.offPeakBatteryCharge > 0

  const savingsEstimate = analysis.hasRates && analysis.shiftedSavings > 0
    ? analysis.shiftedSavings
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Load Shifting Analysis
          </CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-2.5">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2.5">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2.5">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-xs px-2.5">Year</TabsTrigger>
              <TabsTrigger value="lifetime" className="text-xs px-2.5">Life</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="text-primary">Configurable in Settings</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {period === "day" && !hasData ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No time-series data available for today yet. Data points accumulate throughout the day.
            </p>
          </div>
        ) : period === "day" ? (
          <>
            {/* Load shift efficiency gauge */}
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Peak Self-Sufficiency
              </p>
              <p className="text-4xl font-bold tabular-nums text-card-foreground">
                {analysis.loadShiftEfficiency.toFixed(0)}%
              </p>
              <div className="h-3 w-full max-w-xs rounded-full bg-muted">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, analysis.loadShiftEfficiency)}%`,
                    background:
                      analysis.loadShiftEfficiency >= 80
                        ? "hsl(var(--chart-4))"
                        : analysis.loadShiftEfficiency >= 50
                          ? "hsl(var(--chart-2))"
                          : "hsl(var(--chart-5))",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                of peak-hour consumption met by solar + battery (not grid)
              </p>
            </div>

            {/* Off-peak vs Peak breakdown */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Off-peak column */}
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Off-Peak
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Grid Import
                    </span>
                    <span className="font-medium tabular-nums text-card-foreground">
                      {analysis.offPeakGridImport.toFixed(2)} kWh
                    </span>
                  </div>
                  {hasBattery && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Battery className="h-3.5 w-3.5" />
                        Battery Charged
                      </span>
                      <span className="font-medium tabular-nums text-card-foreground">
                        {analysis.offPeakBatteryCharge.toFixed(2)} kWh
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Consumption
                    </span>
                    <span className="font-medium tabular-nums text-card-foreground">
                      {analysis.offPeakConsumption.toFixed(2)} kWh
                    </span>
                  </div>
                  {analysis.hasRates && (
                    <div className="flex items-center justify-between border-t pt-2 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Coins className="h-3.5 w-3.5" />
                        Grid Cost
                      </span>
                      <span className="font-medium tabular-nums text-card-foreground">
                        {currency.symbol}{analysis.offPeakGridCost.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Peak column */}
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Peak
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Sun className="h-3.5 w-3.5" />
                      Solar Direct Use
                    </span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {analysis.peakSolarDirect.toFixed(2)} kWh
                    </span>
                  </div>
                  {hasBattery && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Battery className="h-3.5 w-3.5" />
                        Battery Discharged
                      </span>
                      <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        {analysis.peakBatteryDischarge.toFixed(2)} kWh
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Grid Import
                    </span>
                    <span className="font-medium tabular-nums text-red-500">
                      {analysis.peakGridImport.toFixed(2)} kWh
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Consumption
                    </span>
                    <span className="font-medium tabular-nums text-card-foreground">
                      {analysis.peakConsumption.toFixed(2)} kWh
                    </span>
                  </div>
                  {analysis.hasRates && (
                    <div className="flex items-center justify-between border-t pt-2 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Coins className="h-3.5 w-3.5" />
                        Grid Cost
                      </span>
                      <span className="font-medium tabular-nums text-red-500">
                        {currency.symbol}{analysis.peakGridCost.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Energy Shifted</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                  {analysis.loadShiftedEnergy.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Consumption</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                  {analysis.totalConsumption.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Peak Grid Avoided</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {(analysis.peakBatteryDischarge + analysis.peakSolarDirect).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              {savingsEstimate !== null ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Shift Savings</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {currency.symbol}{savingsEstimate.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">today</p>
                </div>
              ) : (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Data Points</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {analysis.offPeakPoints + analysis.peakPoints}
                  </p>
                  <p className="text-xs text-muted-foreground">readings</p>
                </div>
              )}
            </div>

            {/* Monetary summary */}
            {analysis.hasRates && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Grid Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currency.symbol}{analysis.totalGridCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">import cost</p>
                </div>
                {analysis.gridExportRevenue > 0.01 && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Export Revenue</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {currency.symbol}{analysis.gridExportRevenue.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">feed-in</p>
                  </div>
                )}
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Net Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currency.symbol}{analysis.netCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">after export</p>
                </div>
                {analysis.costWithoutSolar > 0.01 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Without Solar</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-muted-foreground line-through">
                      {currency.symbol}{analysis.costWithoutSolar.toFixed(2)}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      saving {currency.symbol}{(analysis.costWithoutSolar - analysis.netCost).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tariff breakdown */}
            {analysis.hasRates && analysis.tariffBreakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cost by Tariff Period (Today)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Period</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Hours</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Rate</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Grid Import</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analysis.tariffBreakdown.map((b) => {
                        const dotColorMap: Record<string, string> = {
                          indigo: "bg-indigo-500",
                          sky: "bg-sky-500",
                          amber: "bg-amber-500",
                          red: "bg-red-500",
                          emerald: "bg-emerald-500",
                          violet: "bg-violet-500",
                          orange: "bg-orange-500",
                          rose: "bg-rose-500",
                          teal: "bg-teal-500",
                          slate: "bg-slate-500",
                        }
                        const slots = getTariffSlots(b.group)
                        const hoursLabel = slots.map((s) => `${formatHour(s.startHour)}\u2013${formatHour(s.endHour)}`).join(", ")
                        return (
                          <tr key={b.group.id}>
                            <td className="flex items-center gap-2 px-3 py-2 font-medium text-card-foreground">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dotColorMap[b.group.color] || "bg-primary"}`} />
                              {b.group.name}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                              {hoursLabel}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-card-foreground">
                              {b.group.rate > 0 ? `${currency.symbol}${b.group.rate}` : "--"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-card-foreground">
                              {b.gridImport.toFixed(2)} kWh
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-card-foreground">
                              {b.cost > 0 ? `${currency.symbol}${b.cost.toFixed(2)}` : "--"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={3} className="px-3 py-2 text-xs font-medium text-muted-foreground">Total Grid Cost</td>
                        <td className="px-3 py-2 text-right tabular-nums text-card-foreground">
                          {analysis.tariffBreakdown.reduce((s, b) => s + b.gridImport, 0).toFixed(2)} kWh
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-card-foreground">
                          {analysis.totalGridCost > 0 ? `${currency.symbol}${analysis.totalGridCost.toFixed(2)}` : "--"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Week / Month / Year / Lifetime summary view */
          <>
            {/* Energy overview grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Production</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                  {currentSummary.production.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Consumption</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                  {currentSummary.consumption.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Self-Consumed</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {Math.max(0, currentSummary.production - currentSummary.gridExport).toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
            </div>

            {/* Grid exchange */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Grid Import</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-red-500">
                  {currentSummary.gridImport.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Grid Export</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {currentSummary.gridExport.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
            </div>

            {/* Battery */}
            {(currentSummary.batteryCharge > 0 || currentSummary.batteryDischarge > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Battery Charge</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currentSummary.batteryCharge.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">kWh</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Battery Discharge</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currentSummary.batteryDischarge.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">kWh</p>
                </div>
              </div>
            )}

            {/* Cost summary */}
            {avgRate > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Import Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currency.symbol}{currentSummary.gridImportCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">grid purchases</p>
                </div>
                {currentSummary.gridExportRevenue > 0.01 && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Export Revenue</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {currency.symbol}{currentSummary.gridExportRevenue.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">feed-in</p>
                  </div>
                )}
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Net Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currency.symbol}{currentSummary.netCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">after export</p>
                </div>
                {currentSummary.consumption > 0 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Without Solar</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-muted-foreground line-through">
                      {currency.symbol}{(currentSummary.consumption * avgRate).toFixed(2)}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      saving {currency.symbol}{(currentSummary.consumption * avgRate - currentSummary.netCost).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Daily average for non-day periods */}
            {currentSummary.days > 1 && avgRate > 0 && (
              <div className="rounded-lg bg-muted/40 px-4 py-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-card-foreground">Daily average:</strong>{" "}
                  {currency.symbol}{(currentSummary.netCost / currentSummary.days).toFixed(2)} net cost,{" "}
                  {(currentSummary.gridImport / currentSummary.days).toFixed(1)} kWh imported,{" "}
                  {(currentSummary.gridExport / currentSummary.days).toFixed(1)} kWh exported
                  {" "}&middot; Based on {currentSummary.days} day{currentSummary.days !== 1 ? "s" : ""} of data
                </p>
              </div>
            )}
          </>
        )}

        {/* Explanation */}
        <div className="rounded-lg bg-muted/40 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-card-foreground">Load shifting</strong> moves electricity consumption from expensive peak times to cheap off-peak hours.
            Your battery charges from the grid at off-peak rates, then discharges during the day to power your home and avoid costly peak imports.
            Combined with direct solar usage, this maximizes self-sufficiency and minimizes your electricity bill.
            Configure your tariff rate groups in Settings to see per-period cost breakdowns and savings estimates.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
