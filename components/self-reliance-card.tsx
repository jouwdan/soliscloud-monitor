"use client"

import { useMemo } from "react"
import { ShieldCheck, Sun } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  toKWh,
  toKW,
  pickGridPower,
  pickGridPowerPec,
  getTariffForHour,
  type InverterDetail,
  type InverterDayEntry,
  type InverterMonthEntry,
  type TariffGroup,
  type CurrencySettings,
} from "@/lib/solis-client"

interface SelfRelianceCardProps {
  detail: InverterDetail
  dayData?: InverterDayEntry[]
  monthData?: InverterMonthEntry[]
  tariffGroups: TariffGroup[]
  currency: CurrencySettings
  exportRate: number
  hasRates: boolean
}

export function SelfRelianceCard({
  detail,
  dayData,
  monthData,
  tariffGroups,
  currency,
  exportRate,
  hasRates,
}: SelfRelianceCardProps) {
  const computeTOUCost = useMemo(
    () => (
      data: InverterDayEntry[],
      meteredImport: number,
      meteredExport: number,
      meteredLoad: number
    ) => {
      if (!data.length || !hasRates) return { gridCost: 0, exportRev: 0, fullGridCost: 0 }
      const sorted = [...data].sort(
        (a, b) => Number(a.dataTimestamp) - Number(b.dataTimestamp)
      )
      // Accumulate raw proportional shares per tariff group
      const groupRaw = new Map<string, { gi: number; ld: number }>()
      for (const g of tariffGroups) groupRaw.set(g.id, { gi: 0, ld: 0 })

      let rawGI = 0,
        rawGE = 0,
        rawLoad = 0
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i]
        let ts = Number(entry.dataTimestamp)
        if (ts > 0 && ts < 1e12) ts *= 1000
        const hour = new Date(ts).getHours()

        let intervalHours = 5 / 60
        if (i > 0) {
          let prev = Number(sorted[i - 1].dataTimestamp)
          if (prev > 0 && prev < 1e12) prev *= 1000
          const diff = (ts - prev) / (1000 * 60 * 60)
          if (diff > 0 && diff < 1) intervalHours = diff
        }

        const raw = entry as Record<string, unknown>
        const sharedPec = entry.pacPec
        const unitFallback = entry.pacStr // "W" in most responses – use as fallback when metric has no Str
        const gridPec = pickGridPowerPec(raw, sharedPec)
        const gridPick = pickGridPower(entry)
        const gridPower = toKW(gridPick.value, gridPick.unit || unitFallback, gridPec)
        const loadPower = toKW(
          entry.familyLoadPower,
          entry.familyLoadPowerStr || unitFallback,
          (raw.familyLoadPowerPec ?? sharedPec) as string | undefined
        )

        // Solis: negative pSum = grid import, positive = grid export
        const gi = gridPower < 0 ? Math.abs(gridPower) * intervalHours : 0
        const ge = gridPower > 0 ? gridPower * intervalHours : 0
        const ld = loadPower > 0 ? loadPower * intervalHours : 0
        rawGI += gi
        rawGE += ge
        rawLoad += ld

        const matchedGroup = getTariffForHour(hour, tariffGroups)
        if (matchedGroup) {
          const acc = groupRaw.get(matchedGroup.id)!
          acc.gi += gi
          acc.ld += ld
        }
      }

      // Scale to metered totals
      const scaleGI = rawGI > 0 ? meteredImport / rawGI : 0
      const scaleLD = rawLoad > 0 ? meteredLoad / rawLoad : 0
      let gridCost = 0
      let fullGridCost = 0
      for (const g of tariffGroups) {
        const raw = groupRaw.get(g.id)!
        gridCost += raw.gi * scaleGI * g.rate
        fullGridCost += raw.ld * scaleLD * g.rate
      }
      const exportRev = meteredExport * exportRate
      return { gridCost, exportRev, fullGridCost }
    },
    [tariffGroups, hasRates, exportRate]
  )

  const produced = toKWh(detail.eToday, detail.eTodayStr)
  const exported = toKWh(detail.gridSellTodayEnergy, detail.gridSellTodayEnergyStr)
  const imported = toKWh(
    detail.gridPurchasedTodayEnergy,
    detail.gridPurchasedTodayEnergyStr
  )
  const consumed = toKWh(detail.homeLoadTodayEnergy, detail.homeLoadTodayEnergyStr)
  const battDischarge = toKWh(
    detail.batteryTodayDischargeEnergy,
    detail.batteryTodayDischargeEnergyStr
  )

  const selfSupplied = Math.min(
    consumed,
    Math.max(0, produced - exported) + battDischarge
  )
  const gridToHome = Math.max(0, consumed - selfSupplied)
  const clampedExport = Math.min(exported, produced)
  const selfConsumptionRate =
    produced > 0.01 ? ((produced - clampedExport) / produced) * 100 : 0
  const selfRelianceRate = consumed > 0.01 ? (selfSupplied / consumed) * 100 : 0

  const touToday = computeTOUCost(dayData || [], imported, exported, consumed)
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
              <p className="text-[10px] font-medium text-muted-foreground">
                Self-Reliance
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-card-foreground">
                {selfRelianceRate.toFixed(0)}%
              </p>
              <div className="mx-auto mt-1.5 h-1.5 w-full max-w-[120px] rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, selfRelianceRate)}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                of load met without grid
              </p>
            </div>
            <div className="text-center">
              <Sun className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="text-[10px] font-medium text-muted-foreground">
                Self-Consumption
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-card-foreground">
                {selfConsumptionRate.toFixed(0)}%
              </p>
              <div className="mx-auto mt-1.5 h-1.5 w-full max-w-[120px] rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, selfConsumptionRate)}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                of production used directly
              </p>
            </div>
          </div>
          {detail.homeLoadYesterdayEnergy > 0 &&
            (() => {
              const yesterdayLoad = toKWh(
                detail.homeLoadYesterdayEnergy,
                detail.homeLoadYesterdayEnergyStr
              )
              const delta = consumed - yesterdayLoad
              return (
                <div className="mt-2 pt-2 border-t text-center text-xs text-muted-foreground">
                  Yesterday&apos;s load: {yesterdayLoad.toFixed(1)} kWh
                  {consumed > 0.01 && (
                    <span
                      className={
                        delta > 0 ? "text-red-400 ml-1" : "text-emerald-400 ml-1"
                      }
                    >
                      ({delta > 0 ? "+" : ""}
                      {delta.toFixed(1)} kWh today)
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
                <p className="text-[10px] font-medium text-muted-foreground">
                  Saved Today
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {currency.symbol}
                  {valueSaved.toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {selfSupplied.toFixed(1)} kWh self-supplied
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-[10px] font-medium text-muted-foreground">
                  Grid Cost
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-card-foreground">
                  {currency.symbol}
                  {gridCostToday.toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {gridToHome.toFixed(1)} kWh to home
                </p>
              </div>
              {exportRate > 0 ? (
                <div className="rounded-md bg-emerald-500/5 p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Export Revenue
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {currency.symbol}
                    {exportRevenue.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {clampedExport.toFixed(1)} kWh exported
                  </p>
                </div>
              ) : (
                <div className="rounded-md border p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Without Solar
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-muted-foreground line-through">
                    {currency.symbol}
                    {fullGridCost.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {consumed.toFixed(1)} kWh from grid
                  </p>
                </div>
              )}
            </div>

            {(() => {
              const days = monthData || []
              const numDays = days.length
              if (numDays < 1 || !hasRates) return null

              const todayImported = toKWh(
                detail.gridPurchasedTodayEnergy,
                detail.gridPurchasedTodayEnergyStr
              )
              const touEffectiveRate =
                todayImported > 0.1
                  ? touToday.gridCost / todayImported
                  : (() => {
                      let tH = 0,
                        wS = 0
                      for (const g of tariffGroups) {
                        if (g.rate <= 0) continue
                        const sl = g.slots?.length
                          ? g.slots
                          : [{ startHour: g.startHour, endHour: g.endHour }]
                        let h = 0
                        for (const s of sl)
                          h +=
                            s.endHour > s.startHour
                              ? s.endHour - s.startHour
                              : 24 - s.startHour + s.endHour
                        if (h > 0) {
                          wS += g.rate * h
                          tH += h
                        }
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
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Estimated Electricity Cost
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Daily Avg</p>
                      <p className="text-base font-bold tabular-nums text-card-foreground">
                        {currency.symbol}
                        {avgDailyCost.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Weekly</p>
                      <p className="text-base font-bold tabular-nums text-card-foreground">
                        {currency.symbol}
                        {(avgDailyCost * 7).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Monthly</p>
                      <p className="text-base font-bold tabular-nums text-card-foreground">
                        {currency.symbol}
                        {totalNetCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </>
  )
}
