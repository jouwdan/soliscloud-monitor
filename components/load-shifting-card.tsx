"use client"

import { useMemo } from "react"
import {
  Moon,
  Sun,
  ArrowDownToLine,
  Battery,
  TrendingUp,
  Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getOffPeakSettings,
  isOffPeakHour,
  getTariffGroups,
  getRateForHour,
  getCurrencySettings,
  toKW,
  type InverterDayEntry,
  type InverterDetail,
  type OffPeakSettings,
  type TariffGroup,
  type CurrencySettings,
} from "@/lib/solis-client"

interface LoadShiftingCardProps {
  detail: InverterDetail
  dayData: InverterDayEntry[]
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

    // Normalise all power readings to kW (pass Pec multiplier when available)
    const gridPower = toKW(entry.pSum, entry.pSumStr, entry.psumCalPec ?? entry.pSumPec)
    const battPower = toKW(entry.batteryPower, entry.batteryPowerStr, entry.batteryPowerPec)
    const solarPower = toKW(entry.pac, entry.pacStr, entry.pacPec)
    const loadPower = toKW(entry.familyLoadPower, entry.familyLoadPowerStr, entry.familyLoadPowerPec)

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

    if (offPeak) {
      offPeakPoints++
      if (gridPower > 0) offPeakGridImport += gridPower * intervalHours
      if (battPower > 0) offPeakBatteryCharge += battPower * intervalHours
      offPeakConsumption += loadPower * intervalHours
    } else {
      peakPoints++
      if (gridPower > 0) peakGridImport += gridPower * intervalHours
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
  }
}

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}${period}`
}

export function LoadShiftingCard({ detail, dayData }: LoadShiftingCardProps) {
  const currency = useMemo(() => getCurrencySettings(), [])

  const analysis = useMemo(() => {
    const settings = getOffPeakSettings()
    const groups = getTariffGroups()
    return analyzeLoadShifting(dayData, settings, groups)
  }, [dayData])

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
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          Load Shifting Analysis
          <span className="ml-auto text-xs font-normal text-muted-foreground">Today</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Off-peak: {formatHour(analysis.settings.startHour)}&ndash;{formatHour(analysis.settings.endHour)} &middot;
          Peak: {formatHour(analysis.settings.endHour)}&ndash;{formatHour(analysis.settings.startHour)} &middot;
          <span className="text-primary"> Configurable in Settings</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasData ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-center">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No time-series data available for today yet. Data points accumulate throughout the day.
            </p>
          </div>
        ) : (
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
                  <span className="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-500">
                    {formatHour(analysis.settings.startHour)}&ndash;{formatHour(analysis.settings.endHour)}
                  </span>
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
                </div>
              </div>

              {/* Peak column */}
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Peak
                  </h3>
                  <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                    {formatHour(analysis.settings.endHour)}&ndash;{formatHour(analysis.settings.startHour)}
                  </span>
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
                        return (
                          <tr key={b.group.id}>
                            <td className="flex items-center gap-2 px-3 py-2 font-medium text-card-foreground">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dotColorMap[b.group.color] || "bg-primary"}`} />
                              {b.group.name}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                              {formatHour(b.group.startHour)}&ndash;{formatHour(b.group.endHour)}
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

            {/* Explanation */}
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-card-foreground">Load shifting</strong> moves electricity consumption from expensive peak times to cheap off-peak hours.
                Your battery charges from the grid at night ({formatHour(analysis.settings.startHour)}&ndash;{formatHour(analysis.settings.endHour)}) at lower rates, then discharges during the day to power your home and avoid costly peak imports.
                Combined with direct solar usage, this maximizes self-sufficiency and minimizes your electricity bill.
                Configure your tariff rate groups in Settings to see per-period cost breakdowns and savings estimates.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
