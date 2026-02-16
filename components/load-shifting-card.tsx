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
  type InverterDayEntry,
  type InverterDetail,
  type OffPeakSettings,
} from "@/lib/solis-client"

interface LoadShiftingCardProps {
  detail: InverterDetail
  dayData: InverterDayEntry[]
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
}

function analyzeLoadShifting(
  dayData: InverterDayEntry[],
  settings: OffPeakSettings
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

  // Sort data by timestamp
  const sorted = [...dayData].sort(
    (a, b) => Number(a.dataTimestamp) - Number(b.dataTimestamp)
  )

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const ts = Number(entry.dataTimestamp)
    const date = new Date(ts)
    const hour = date.getHours()
    const offPeak = isOffPeakHour(hour, settings)

    // Interval in hours (typically 5 min = 1/12 hour)
    let intervalHours = 5 / 60
    if (i > 0) {
      const prev = Number(sorted[i - 1].dataTimestamp)
      const diff = (ts - prev) / (1000 * 60 * 60)
      if (diff > 0 && diff < 1) intervalHours = diff
    }

    const gridPower = entry.pSum || 0 // +ve = importing, -ve = exporting
    const battPower = entry.batteryPower || 0 // +ve = charging, -ve = discharging
    const solarPower = entry.pac || 0
    const loadPower = entry.familyLoadPower || 0

    if (offPeak) {
      offPeakPoints++
      // Grid import during off-peak (cheap rate charging)
      if (gridPower > 0) offPeakGridImport += gridPower * intervalHours
      // Battery charging during off-peak
      if (battPower > 0) offPeakBatteryCharge += battPower * intervalHours
      offPeakConsumption += loadPower * intervalHours
    } else {
      peakPoints++
      // Grid import during peak (expensive)
      if (gridPower > 0) peakGridImport += gridPower * intervalHours
      // Battery discharging during peak (load shifting benefit)
      if (battPower < 0) peakBatteryDischarge += Math.abs(battPower) * intervalHours
      // Solar used directly during peak
      if (solarPower > 0) peakSolarDirect += solarPower * intervalHours
      peakConsumption += loadPower * intervalHours
    }
  }

  const totalConsumption = offPeakConsumption + peakConsumption
  // Energy shifted = battery discharge during peak that was charged during off-peak
  const loadShiftedEnergy = Math.min(offPeakBatteryCharge, peakBatteryDischarge)
  // Efficiency: how much of the peak consumption was met without peak grid import
  const loadShiftEfficiency =
    peakConsumption > 0
      ? Math.min(100, ((peakBatteryDischarge + peakSolarDirect) / peakConsumption) * 100)
      : 0

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
  }
}

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}${period}`
}

export function LoadShiftingCard({ detail, dayData }: LoadShiftingCardProps) {
  const analysis = useMemo(() => {
    const settings = getOffPeakSettings()
    return analyzeLoadShifting(dayData, settings)
  }, [dayData])

  const hasData = analysis.offPeakPoints > 0 || analysis.peakPoints > 0
  const hasBattery =
    detail.batteryTodayChargeEnergy > 0 ||
    detail.batteryTodayDischargeEnergy > 0 ||
    analysis.offPeakBatteryCharge > 0

  const savingsEstimate =
    analysis.settings.peakRate > 0 && analysis.settings.offpeakRate > 0
      ? analysis.loadShiftedEnergy *
        (analysis.settings.peakRate - analysis.settings.offpeakRate)
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
              {savingsEstimate !== null && savingsEstimate > 0 ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Est. Savings</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {savingsEstimate.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.settings.peakRate > 0 ? "c" : ""}
                  </p>
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

            {/* Explanation */}
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-card-foreground">Load shifting</strong> moves electricity consumption from expensive peak times to cheap off-peak hours.
                Your battery charges from the grid at night ({formatHour(analysis.settings.startHour)}&ndash;{formatHour(analysis.settings.endHour)}) at lower rates, then discharges during the day to power your home and avoid costly peak imports.
                Combined with direct solar usage, this maximizes self-sufficiency and minimizes your electricity bill.
                Set your tariff rates in Settings to see estimated savings.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
