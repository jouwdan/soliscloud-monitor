"use client"

import { useMemo, useState } from "react"
import {
  Moon,
  Sun,
  ArrowDownToLine,
  Battery,
  BatteryCharging,
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
  getTariffForHour,
  getCurrencySettings,
  getExportPrice,
  toKW,
  toKWh,
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
  // Battery economics
  batteryChargeCost: number      // cost of energy used to charge battery
  batteryDischargeValue: number  // value of grid imports avoided by discharging
  batteryNetBenefit: number      // dischargeValue - chargeCost
  batteryChargeAvgRate: number   // weighted avg rate during charging
  batteryDischargeAvgRate: number // weighted avg rate during discharging
}

function analyzeLoadShifting(
  dayData: InverterDayEntry[],
  settings: OffPeakSettings,
  tariffGroups: TariffGroup[],
  detail: InverterDetail,
): LoadShiftingAnalysis {
  // ── Authoritative metered totals from detail endpoint ──
  const mGridImport = toKWh(detail.gridPurchasedTodayEnergy, detail.gridPurchasedTodayEnergyStr)
  const mGridExport = toKWh(detail.gridSellTodayEnergy, detail.gridSellTodayEnergyStr)
  const mConsumption = toKWh(detail.homeLoadTodayEnergy, detail.homeLoadTodayEnergyStr)
  const mBattCharge = toKWh(detail.batteryTodayChargeEnergy, detail.batteryTodayChargeEnergyStr)
  const mBattDischarge = toKWh(detail.batteryTodayDischargeEnergy, detail.batteryTodayDischargeEnergyStr)
  const mProduction = toKWh(detail.eToday, detail.eTodayStr)
  const feedInRate = getExportPrice()

  // ── Use 5-min data ONLY for proportional distribution ──
  // We accumulate raw (unnormalised-total) shares to find what fraction
  // of each metric falls in each tariff period / peak vs off-peak bucket.
  let rawGridImport = 0, rawGridExport = 0, rawBattCharge = 0, rawBattDischarge = 0
  let rawSolar = 0, rawLoad = 0
  let rawOffPeakGridImport = 0, rawPeakGridImport = 0
  let rawOffPeakBattCharge = 0, rawPeakBattDischarge = 0
  let rawPeakSolar = 0
  let rawOffPeakLoad = 0, rawPeakLoad = 0
  let offPeakPoints = 0, peakPoints = 0

  // Per-tariff-group raw proportions
  const groupRaw = new Map<string, { gridImport: number; load: number }>()
  for (const g of tariffGroups) groupRaw.set(g.id, { gridImport: 0, load: 0 })

  // Per-tariff-group weighted rate for battery charge / discharge
  let rawBattChargeWeighted = 0, rawBattDischargeWeighted = 0

  const sorted = [...dayData].sort(
    (a, b) => Number(a.dataTimestamp) - Number(b.dataTimestamp)
  )

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    let ts = Number(entry.dataTimestamp)
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

    const raw = entry as Record<string, unknown>
    const sharedPec = entry.pacPec
    const gridPec = (raw.psumPec ?? raw.psumCalPec ?? raw.pSumPec ?? sharedPec) as string | undefined
    const gridPower = toKW(entry.pSum, entry.pSumStr, gridPec)
    const battPower = toKW(entry.batteryPower, entry.batteryPowerStr, (entry.batteryPowerPec ?? sharedPec) as string | undefined)
    const solarPower = toKW(entry.pac, entry.pacStr, entry.pacPec)
    const loadPower = toKW(entry.familyLoadPower, entry.familyLoadPowerStr, (entry.familyLoadPowerPec ?? sharedPec) as string | undefined)
    const rate = getRateForHour(hour, tariffGroups)

    // Solis convention: negative pSum = importing from grid, positive = exporting
    const gi = gridPower < 0 ? Math.abs(gridPower) * intervalHours : 0
    const ge = gridPower > 0 ? gridPower * intervalHours : 0
    const bc = battPower > 0 ? battPower * intervalHours : 0
    const bd = battPower < 0 ? Math.abs(battPower) * intervalHours : 0
    const sl = solarPower > 0 ? solarPower * intervalHours : 0
    const ld = loadPower > 0 ? loadPower * intervalHours : 0

    rawGridImport += gi; rawGridExport += ge
    rawBattCharge += bc; rawBattDischarge += bd
    rawSolar += sl; rawLoad += ld

    // Weighted rate for battery economics
    rawBattChargeWeighted += bc * rate
    rawBattDischargeWeighted += bd * rate

    // Per-tariff-group
    const matchedGroup = getTariffForHour(hour, tariffGroups)
    if (matchedGroup) {
      const acc = groupRaw.get(matchedGroup.id)!
      acc.gridImport += gi
      acc.load += ld
    }

    if (offPeak) {
      offPeakPoints++
      rawOffPeakGridImport += gi
      rawOffPeakBattCharge += bc
      rawOffPeakLoad += ld
    } else {
      peakPoints++
      rawPeakGridImport += gi
      rawPeakBattDischarge += bd
      rawPeakSolar += sl
      rawPeakLoad += ld
    }
  }

  // ── Scale raw proportions to metered totals ──
  const scaleGrid = rawGridImport > 0 ? mGridImport / rawGridImport : 0
  const scaleLoad = rawLoad > 0 ? mConsumption / rawLoad : 0
  const scaleBattC = rawBattCharge > 0 ? mBattCharge / rawBattCharge : 0
  const scaleBattD = rawBattDischarge > 0 ? mBattDischarge / rawBattDischarge : 0
  const scaleSolar = rawSolar > 0 ? mProduction / rawSolar : 0

  const offPeakGridImport = rawOffPeakGridImport * scaleGrid
  const peakGridImport = rawPeakGridImport * scaleGrid
  const offPeakBatteryCharge = rawOffPeakBattCharge * scaleBattC
  const peakBatteryDischarge = rawPeakBattDischarge * scaleBattD
  const peakSolarDirect = rawPeakSolar * scaleSolar
  const offPeakConsumption = rawOffPeakLoad * scaleLoad
  const peakConsumption = rawPeakLoad * scaleLoad
  const totalConsumption = mConsumption

  const loadShiftedEnergy = Math.min(offPeakBatteryCharge, peakBatteryDischarge)
  const loadShiftEfficiency =
    peakConsumption > 0
      ? Math.min(100, ((peakBatteryDischarge + peakSolarDirect) / peakConsumption) * 100)
      : 0

  // ── Cost calculations using scaled values and TOU rates ──
  const hasRates = tariffGroups.some((g) => g.rate > 0)

  const tariffBreakdown: TariffBreakdown[] = tariffGroups
    .map((g) => {
      const raw = groupRaw.get(g.id)!
      const gi = raw.gridImport * scaleGrid
      const cons = raw.load * scaleLoad
      const cost = gi * g.rate
      return { group: g, gridImport: gi, consumption: cons, cost }
    })
    .filter((b) => b.gridImport > 0.001 || b.consumption > 0.001)

  const totalGridCost = tariffBreakdown.reduce((sum, b) => sum + b.cost, 0)
  // Compute off-peak / peak grid cost from tariff breakdown
  const offPeakGridCost = tariffBreakdown.reduce((sum, b) => {
    const isOp = isOffPeakHour(b.group.slots?.[0]?.startHour ?? b.group.startHour, settings)
    return sum + (isOp ? b.cost : 0)
  }, 0)
  const peakGridCost = totalGridCost - offPeakGridCost

  // Export revenue using metered export total
  const gridExportRevenue = mGridExport * feedInRate

  // Battery economics: scale the weighted-rate accumulators
  const batteryChargeCost = rawBattCharge > 0 ? (rawBattChargeWeighted / rawBattCharge) * mBattCharge : 0
  const batteryDischargeValue = rawBattDischarge > 0 ? (rawBattDischargeWeighted / rawBattDischarge) * mBattDischarge : 0

  // Savings: energy shifted * (highest rate - lowest rate)
  const rates = tariffGroups.filter((g) => g.rate > 0).map((g) => g.rate)
  const maxRate = rates.length > 0 ? Math.max(...rates) : 0
  const minRate = rates.length > 0 ? Math.min(...rates) : 0
  const shiftedSavings = hasRates ? loadShiftedEnergy * (maxRate - minRate) : 0

  // Hour-weighted avg rate for "without solar" estimate
  let _totalH = 0, _weightedS = 0
  for (const g of tariffGroups) {
    if (g.rate <= 0) continue
    const sl = g.slots?.length ? g.slots : [{ startHour: g.startHour, endHour: g.endHour }]
    let h = 0
    for (const s of sl) h += s.endHour > s.startHour ? s.endHour - s.startHour : (24 - s.startHour) + s.endHour
    if (h > 0) { _weightedS += g.rate * h; _totalH += h }
  }
  const avgRate = _totalH > 0 ? _weightedS / _totalH : (rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0)

  // "Without solar" = what it would cost if all consumption came from grid
  // Use TOU-weighted consumption cost from tariff breakdown
  const costWithoutSolar = tariffBreakdown.reduce((sum, b) => sum + b.consumption * b.group.rate, 0) || mConsumption * avgRate
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
    batteryChargeCost,
    batteryDischargeValue,
    batteryNetBenefit: batteryDischargeValue - batteryChargeCost,
    batteryChargeAvgRate: mBattCharge > 0 ? batteryChargeCost / mBattCharge : 0,
    batteryDischargeAvgRate: mBattDischarge > 0 ? batteryDischargeValue / mBattDischarge : 0,
  }
}

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}${period}`
}

type Period = "day" | "week" | "month" | "year" | "lifetime"

/** Format a kWh value with adaptive unit */
function fmtE(kwh: number): { text: string; unit: string } {
  if (kwh >= 1000) return { text: (kwh / 1000).toFixed(2), unit: "MWh" }
  return { text: kwh.toFixed(1), unit: "kWh" }
}

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
  todayTOUGridCost?: number,
  todayTOUExportRev?: number,
): Record<Period, PeriodSummary> {
  // Shorthand: normalise a detail energy value to kWh using its companion *Str field
  const k = (val: number | undefined, unitStr: string | undefined) => toKWh(val, unitStr)

  // Day (Today values – typically already in kWh but normalise to be safe)
  const dayImport = k(detail.gridPurchasedTodayEnergy, detail.gridPurchasedTodayEnergyStr)
  const dayExport = k(detail.gridSellTodayEnergy, detail.gridSellTodayEnergyStr)

  // Week (last 7 days from month data – month entries are always in kWh)
  const sorted = [...monthData].sort((a, b) => (b.date || 0) - (a.date || 0))
  const weekDays = sorted.slice(0, 7)
  const weekImport = weekDays.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0)
  const weekExport = weekDays.reduce((s, d) => s + (d.gridSellEnergy || 0), 0)

  // Month – prefer detail aggregate (normalised), fall back to summing entries
  const monthImportFb = monthData.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0)
  const monthExportFb = monthData.reduce((s, d) => s + (d.gridSellEnergy || 0), 0)
  const monthImport = detail.gridPurchasedMonthEnergy != null ? k(detail.gridPurchasedMonthEnergy, detail.gridPurchasedMonthEnergyStr) : monthImportFb
  const monthExport = detail.gridSellMonthEnergy != null ? k(detail.gridSellMonthEnergy, detail.gridSellMonthEnergyStr) : monthExportFb

  // Year
  const yearImportFb = yearData.reduce((s, d) => s + (d.gridPurchasedEnergy || 0), 0)
  const yearExportFb = yearData.reduce((s, d) => s + (d.gridSellEnergy || 0), 0)
  const yearImport = detail.gridPurchasedYearEnergy != null ? k(detail.gridPurchasedYearEnergy, detail.gridPurchasedYearEnergyStr) : yearImportFb
  const yearExport = detail.gridSellYearEnergy != null ? k(detail.gridSellYearEnergy, detail.gridSellYearEnergyStr) : yearExportFb

  // Lifetime
  const totalImport = k(detail.gridPurchasedTotalEnergy, detail.gridPurchasedTotalEnergyStr)
  const totalExport = k(detail.gridSellTotalEnergy, detail.gridSellTotalEnergyStr)

  // For the "day" period, use actual TOU costs from the analysis if available
  const dayGridCost = todayTOUGridCost ?? dayImport * avgRate
  const dayExportRev = todayTOUExportRev ?? dayExport * exportRate

  // For longer periods we derive an effective rate from today's TOU data
  // This better reflects the actual tariff mix vs a simple hour-weighted avg
  const touEffectiveRate = dayImport > 0.1 && todayTOUGridCost != null
    ? todayTOUGridCost / dayImport
    : avgRate

  const make = (label: string, imp: number, exp: number, prod: number, cons: number, battC: number, battD: number, days: number, overrideGridCost?: number, overrideExportRev?: number): PeriodSummary => {
    const gridCost = overrideGridCost ?? imp * touEffectiveRate
    const expRev = overrideExportRev ?? exp * exportRate
    return {
      label,
      gridImport: imp,
      gridExport: exp,
      gridImportCost: gridCost,
      gridExportRevenue: expRev,
      netCost: gridCost - expRev,
      consumption: cons,
      production: prod,
      batteryCharge: battC,
      batteryDischarge: battD,
      days,
    }
  }

  return {
    day: make("Today", dayImport, dayExport,
      k(detail.eToday, detail.eTodayStr),
      k(detail.homeLoadTodayEnergy, detail.homeLoadTodayEnergyStr),
      k(detail.batteryTodayChargeEnergy, detail.batteryTodayChargeEnergyStr),
      k(detail.batteryTodayDischargeEnergy, detail.batteryTodayDischargeEnergyStr), 1, dayGridCost, dayExportRev),
    week: make("This Week", weekImport, weekExport,
      weekDays.reduce((s, d) => s + (d.energy || 0), 0),
      weekDays.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
      weekDays.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
      weekDays.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
      weekDays.length),
    month: make("This Month", monthImport, monthExport,
      k(detail.eMonth, detail.eMonthStr),
      detail.homeLoadMonthEnergy != null ? k(detail.homeLoadMonthEnergy, detail.homeLoadMonthEnergyStr) : monthData.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
      detail.batteryMonthChargeEnergy != null ? k(detail.batteryMonthChargeEnergy, detail.batteryMonthChargeEnergyStr) : monthData.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
      detail.batteryMonthDischargeEnergy != null ? k(detail.batteryMonthDischargeEnergy, detail.batteryMonthDischargeEnergyStr) : monthData.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
      monthData.length || 30),
    year: make("This Year", yearImport, yearExport,
      k(detail.eYear, detail.eYearStr),
      detail.homeLoadYearEnergy != null ? k(detail.homeLoadYearEnergy, detail.homeLoadYearEnergyStr) : yearData.reduce((s, d) => s + (d.homeLoadEnergy || 0), 0),
      detail.batteryYearChargeEnergy != null ? k(detail.batteryYearChargeEnergy, detail.batteryYearChargeEnergyStr) : yearData.reduce((s, d) => s + (d.batteryChargeEnergy || 0), 0),
      detail.batteryYearDischargeEnergy != null ? k(detail.batteryYearDischargeEnergy, detail.batteryYearDischargeEnergyStr) : yearData.reduce((s, d) => s + (d.batteryDischargeEnergy || 0), 0),
      yearData.length || 365),
    lifetime: make("Lifetime", totalImport, totalExport,
      k(detail.eTotal, detail.eTotalStr),
      k(detail.homeLoadTotalEnergy, detail.homeLoadTotalEnergyStr),
      k(detail.batteryTotalChargeEnergy, detail.batteryTotalChargeEnergyStr),
      k(detail.batteryTotalDischargeEnergy, detail.batteryTotalDischargeEnergyStr), 0),
  }
}

export function LoadShiftingCard({ detail, dayData, monthData, yearData }: LoadShiftingCardProps) {
  const currency = useMemo(() => getCurrencySettings(), [])
  const [period, setPeriod] = useState<Period>("day")

  const analysis = useMemo(() => {
    const settings = getOffPeakSettings()
    const groups = getTariffGroups()
    return analyzeLoadShifting(dayData, settings, groups, detail)
  }, [dayData, detail])

  const tariffGroups = useMemo(() => getTariffGroups(), [])
  const avgRate = useMemo(() => {
    let totalH = 0, weightedS = 0
    for (const g of tariffGroups) {
      if (g.rate <= 0) continue
      const sl = g.slots?.length ? g.slots : [{ startHour: g.startHour, endHour: g.endHour }]
      let h = 0
      for (const s of sl) h += s.endHour > s.startHour ? s.endHour - s.startHour : (24 - s.startHour) + s.endHour
      if (h > 0) { weightedS += g.rate * h; totalH += h }
    }
    if (totalH > 0) return weightedS / totalH
    const rates = tariffGroups.filter((g) => g.rate > 0).map((g) => g.rate)
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  }, [tariffGroups])
  const exportRate = useMemo(() => getExportPrice(), [])

  const summaries = useMemo(
    () => computePeriodSummaries(
      detail, monthData || [], yearData || [], avgRate, exportRate,
      analysis.hasRates ? analysis.totalGridCost : undefined,
      analysis.hasRates ? analysis.gridExportRevenue : undefined,
    ),
    [detail, monthData, yearData, avgRate, exportRate, analysis]
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
            {/* Self-sufficiency + key stats */}
            <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-5 py-4">
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-bold tabular-nums text-card-foreground">
                  {analysis.loadShiftEfficiency.toFixed(0)}%
                </p>
                <div className="h-2 w-16 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full transition-all"
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
                <p className="text-[10px] text-muted-foreground">self-sufficient</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="grid flex-1 grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-lg font-bold tabular-nums text-card-foreground">{analysis.totalConsumption.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">kWh consumed</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{analysis.loadShiftedEnergy.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">kWh shifted</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{(analysis.peakBatteryDischarge + analysis.peakSolarDirect).toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">kWh peak avoided</p>
                </div>
              </div>
            </div>

            {/* Combined energy breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Metric</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Moon className="h-3 w-3 text-indigo-400" /> Off-Peak</span>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Sun className="h-3 w-3 text-amber-500" /> Peak</span>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-card-foreground"><ArrowDownToLine className="h-3.5 w-3.5 text-red-500" /> Grid Import</td>
                    <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{analysis.offPeakGridImport.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-500">{analysis.peakGridImport.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-card-foreground">{(analysis.offPeakGridImport + analysis.peakGridImport).toFixed(2)} kWh</td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-card-foreground"><Sun className="h-3.5 w-3.5 text-primary" /> Solar Direct</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">--</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{analysis.peakSolarDirect.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{analysis.peakSolarDirect.toFixed(2)} kWh</td>
                  </tr>
                  {hasBattery && (
                  <>
                  <tr>
                    <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-card-foreground"><BatteryCharging className="h-3.5 w-3.5 text-primary" /> Batt Charge</td>
                    <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{analysis.offPeakBatteryCharge.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">--</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-card-foreground">{analysis.offPeakBatteryCharge.toFixed(2)} kWh</td>
                  </tr>
                  <tr>
                    <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-card-foreground"><Battery className="h-3.5 w-3.5 text-primary" /> Batt Discharge</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">--</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{analysis.peakBatteryDischarge.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{analysis.peakBatteryDischarge.toFixed(2)} kWh</td>
                  </tr>
                  </>
                  )}
                  <tr>
                    <td className="px-3 py-2 font-medium text-card-foreground">Consumption</td>
                    <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{analysis.offPeakConsumption.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{analysis.peakConsumption.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-card-foreground">{analysis.totalConsumption.toFixed(2)} kWh</td>
                  </tr>
                  {analysis.hasRates && (
                  <tr className="bg-muted/30">
                    <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-card-foreground"><Coins className="h-3.5 w-3.5" /> Grid Cost</td>
                    <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{currency.symbol}{analysis.offPeakGridCost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-500">{currency.symbol}{analysis.peakGridCost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-card-foreground">{currency.symbol}{analysis.totalGridCost.toFixed(2)}</td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial summary */}
            {analysis.hasRates && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {hasBattery && (analysis.batteryChargeCost > 0.001 || analysis.batteryDischargeValue > 0.001) && (
                  <div className={`rounded-lg p-3 text-center ${analysis.batteryNetBenefit >= 0 ? "border border-emerald-500/30 bg-emerald-500/5" : "border border-red-500/30 bg-red-500/5"}`}>
                    <p className="text-xs text-muted-foreground">Battery Arbitrage</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${analysis.batteryNetBenefit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {analysis.batteryNetBenefit >= 0 ? "+" : ""}{currency.symbol}{analysis.batteryNetBenefit.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {currency.symbol}{analysis.batteryChargeCost.toFixed(2)} in &rarr; {currency.symbol}{analysis.batteryDischargeValue.toFixed(2)} out
                    </p>
                  </div>
                )}
                {analysis.gridExportRevenue > 0.01 && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Export Revenue</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {currency.symbol}{analysis.gridExportRevenue.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">feed-in</p>
                  </div>
                )}
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Net Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                    {currency.symbol}{analysis.netCost.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">after export</p>
                </div>
                {analysis.costWithoutSolar > 0.01 && (() => {
                  const solarSaving = analysis.costWithoutSolar - analysis.netCost
                  return (
                  <div className={`rounded-lg p-3 text-center ${solarSaving >= 0 ? "border border-emerald-500/30 bg-emerald-500/5" : "border"}`}>
                    <p className="text-xs text-muted-foreground">Without Solar</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-muted-foreground line-through">
                      {currency.symbol}{analysis.costWithoutSolar.toFixed(2)}
                    </p>
                    <p className={`text-[10px] ${solarSaving >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {solarSaving >= 0 ? "saving" : "extra"} {currency.symbol}{Math.abs(solarSaving).toFixed(2)}
                    </p>
                  </div>
                  )
                })()}
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
            {/* Energy summary table */}
            {(() => {
              const selfConsumed = Math.max(0, currentSummary.production - currentSummary.gridExport)
              const rows: { label: string; value: number; color?: string }[] = [
                { label: "Production", value: currentSummary.production },
                { label: "Consumption", value: currentSummary.consumption },
                { label: "Self-Consumed", value: selfConsumed, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Grid Import", value: currentSummary.gridImport, color: "text-red-500" },
                { label: "Grid Export", value: currentSummary.gridExport, color: "text-emerald-600 dark:text-emerald-400" },
              ]
              if (currentSummary.batteryCharge > 0 || currentSummary.batteryDischarge > 0) {
                rows.push({ label: "Batt Charge", value: currentSummary.batteryCharge })
                rows.push({ label: "Batt Discharge", value: currentSummary.batteryDischarge, color: "text-emerald-600 dark:text-emerald-400" })
              }
              return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {rows.map((r) => { const f = fmtE(r.value); return (
                      <tr key={r.label}>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.label}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${r.color || "text-card-foreground"}`}>{f.text} <span className="text-muted-foreground font-normal">{f.unit}</span></td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              )
            })()}

            {/* Financial summary with battery */}
            {avgRate > 0 && (() => {
              const rates = tariffGroups.filter((g) => g.rate > 0).map((g) => g.rate)
              const minRate = rates.length > 0 ? Math.min(...rates) : avgRate
              const maxRate = rates.length > 0 ? Math.max(...rates) : avgRate
              const hasBatt = currentSummary.batteryCharge > 0 || currentSummary.batteryDischarge > 0
              const estBenefit = hasBatt ? currentSummary.batteryDischarge * maxRate - currentSummary.batteryCharge * minRate : 0
              const withoutSolar = currentSummary.consumption * avgRate
              return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Import Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">{currency.symbol}{currentSummary.gridImportCost.toFixed(2)}</p>
                </div>
                {currentSummary.gridExportRevenue > 0.01 && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Export Revenue</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{currency.symbol}{currentSummary.gridExportRevenue.toFixed(2)}</p>
                  </div>
                )}
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Net Cost</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">{currency.symbol}{currentSummary.netCost.toFixed(2)}</p>
                </div>
                {withoutSolar > 0.01 && (() => {
                  const periodSaving = withoutSolar - currentSummary.netCost
                  return (
                  <div className={`rounded-lg p-3 text-center ${periodSaving >= 0 ? "border border-emerald-500/30 bg-emerald-500/5" : "border"}`}>
                    <p className="text-xs text-muted-foreground">{periodSaving >= 0 ? "Saving vs Grid" : "Without Solar"}</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${periodSaving >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground line-through"}`}>
                      {currency.symbol}{(periodSaving >= 0 ? periodSaving : withoutSolar).toFixed(2)}
                    </p>
                  </div>
                  )
                })()}
                {hasBatt && (
                  <div className={`rounded-lg p-3 text-center ${estBenefit >= 0 ? "border border-emerald-500/30 bg-emerald-500/5" : "border border-red-500/30 bg-red-500/5"}`}>
                    <p className="text-xs text-muted-foreground">Batt Arbitrage</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${estBenefit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {estBenefit >= 0 ? "+" : ""}{currency.symbol}{estBenefit.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">est. {currency.symbol}{minRate.toFixed(2)} in / {currency.symbol}{maxRate.toFixed(2)} out</p>
                  </div>
                )}
              </div>
              )
            })()}

            {/* Daily average for non-day periods */}
            {currentSummary.days > 1 && avgRate > 0 && (
              <div className="rounded-lg bg-muted/40 px-4 py-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-card-foreground">Avg/day:</strong>{" "}
                  {currency.symbol}{(currentSummary.netCost / currentSummary.days).toFixed(2)} net,{" "}
                  {fmtE(currentSummary.gridImport / currentSummary.days).text} {fmtE(currentSummary.gridImport / currentSummary.days).unit} in,{" "}
                  {fmtE(currentSummary.gridExport / currentSummary.days).text} {fmtE(currentSummary.gridExport / currentSummary.days).unit} out
                  {" "}&middot; {currentSummary.days} days
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
