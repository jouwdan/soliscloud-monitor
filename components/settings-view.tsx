"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sun,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Timer,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useStationList,
  getSavedCredentials,
  clearCredentials,
  getRefreshSeconds,
  saveRefreshSeconds,
  getTariffGroups,
  saveTariffGroups,
  getCurrencySettings,
  saveCurrencySettings,
  getExportPrice,
  saveExportPrice,
  CURRENCY_OPTIONS,
  getTariffSlots,
  type TariffGroup,
  type TariffTimeSlot,
  type CurrencySettings,
} from "@/lib/solis-client"
import { Plus, Trash2, Coins, ArrowUpFromLine } from "lucide-react"

export function SettingsView() {
  const router = useRouter()
  const { data: stationData, isLoading, mutate } = useStationList()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)
  const creds = getSavedCredentials()
  const [refreshSeconds, setRefreshSeconds] = useState(() => getRefreshSeconds())
  const [refreshSaved, setRefreshSaved] = useState(false)

  const [tariffGroups, setTariffGroups] = useState<TariffGroup[]>(() => getTariffGroups())
  const [tariffSaved, setTariffSaved] = useState(false)
  const [currency, setCurrency] = useState<CurrencySettings>(() => getCurrencySettings())
  const [currencySaved, setCurrencySaved] = useState(false)
  const [exportPrice, setExportPrice] = useState(() => getExportPrice())
  const [exportPriceSaved, setExportPriceSaved] = useState(false)

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (creds) {
        headers["x-solis-api-id"] = creds.apiId
        headers["x-solis-api-secret"] = creds.apiSecret
      }
      const res = await fetch("/api/solis", {
        method: "POST",
        headers,
        body: JSON.stringify({
          endpoint: "/v1/api/userStationList",
          body: { pageNo: 1, pageSize: 1 },
        }),
      })
      if (!res.ok) throw new Error("Failed")
      setTestResult("success")
    } catch {
      setTestResult("error")
    } finally {
      setTesting(false)
    }
  }

  function handleDisconnect() {
    clearCredentials()
    router.push("/")
    router.refresh()
  }

  const stations = stationData?.page?.records || []
  const maskedId = creds
    ? creds.apiId.slice(0, 4) + "..." + creds.apiId.slice(-4)
    : "Not set"

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your SolisCloud API connection
        </p>
      </div>

      {/* API Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Sun className="h-4 w-4 text-primary" />
            SolisCloud API Connection
          </CardTitle>
          <CardDescription>
            Your credentials are stored locally in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">API ID</p>
              <p className="mt-1 font-mono text-sm text-card-foreground">
                {maskedId}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">API Secret</p>
              <p className="mt-1 font-mono text-sm text-card-foreground">
                {creds ? "********" : "Not set"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleTestConnection} disabled={testing} size="sm">
              {testing ? (
                <>
                  <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              onClick={handleDisconnect}
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <LogOut className="mr-2 h-3 w-3" />
              Disconnect
            </Button>
            {testResult === "success" && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Connection successful
              </span>
            )}
            {testResult === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Connection failed
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Refresh */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Timer className="h-4 w-4 text-primary" />
            Data Refresh Interval
          </CardTitle>
          <CardDescription>
            How often the dashboard fetches new data from SolisCloud.
            Solis updates data every ~5 minutes, so shorter intervals may not yield new values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="refresh-seconds" className="text-card-foreground">
                Refresh every
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="refresh-seconds"
                  type="number"
                  min={10}
                  max={3600}
                  step={10}
                  value={refreshSeconds}
                  onChange={(e) => {
                    setRefreshSeconds(parseInt(e.target.value, 10) || 60)
                    setRefreshSaved(false)
                  }}
                  className="w-28 font-mono tabular-nums"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Min 10s. Currently: {refreshSeconds >= 60 ? `${Math.floor(refreshSeconds / 60)}m${refreshSeconds % 60 ? ` ${refreshSeconds % 60}s` : ""}` : `${refreshSeconds}s`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  const clamped = Math.max(10, Math.min(3600, refreshSeconds))
                  setRefreshSeconds(clamped)
                  saveRefreshSeconds(clamped)
                  setRefreshSaved(true)
                  setTimeout(() => setRefreshSaved(false), 3000)
                }}
              >
                Save
              </Button>
              {refreshSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Saved -- reload pages to apply
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "30s", value: 30 },
              { label: "1 min", value: 60 },
              { label: "2 min", value: 120 },
              { label: "5 min", value: 300 },
              { label: "10 min", value: 600 },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  setRefreshSeconds(preset.value)
                  saveRefreshSeconds(preset.value)
                  setRefreshSaved(true)
                  setTimeout(() => setRefreshSaved(false), 3000)
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  refreshSeconds === preset.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-card-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Coins className="h-4 w-4 text-amber-500" />
            Currency
          </CardTitle>
          <CardDescription>
            Select your local currency for cost and savings display.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CURRENCY_OPTIONS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c)
                  saveCurrencySettings(c)
                  setCurrencySaved(true)
                  setTimeout(() => setCurrencySaved(false), 3000)
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  currency.code === c.code
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-card-foreground"
                }`}
              >
                {c.symbol} {c.code}
              </button>
            ))}
          </div>
          {currencySaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </span>
          )}
        </CardContent>
      </Card>

      {/* Export / Feed-in Price */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <ArrowUpFromLine className="h-4 w-4 text-emerald-500" />
            Export / Feed-in Tariff
          </CardTitle>
          <CardDescription>
            The rate you receive for exporting surplus solar to the grid ({currency.symbol}/kWh).
            Set to 0 if you don{"'"}t have a feed-in tariff.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-price" className="text-card-foreground">
                Export rate
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{currency.symbol}</span>
                <Input
                  id="export-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={exportPrice || ""}
                  placeholder="0.00"
                  onChange={(e) => {
                    setExportPrice(parseFloat(e.target.value) || 0)
                    setExportPriceSaved(false)
                  }}
                  className="w-28 font-mono tabular-nums"
                />
                <span className="text-sm text-muted-foreground">per kWh</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  saveExportPrice(exportPrice)
                  setExportPriceSaved(true)
                  setTimeout(() => setExportPriceSaved(false), 3000)
                }}
              >
                Save
              </Button>
              {exportPriceSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tariff Rate Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Timer className="h-4 w-4 text-amber-500" />
            Tariff Rate Groups
          </CardTitle>
          <CardDescription>
            Define your time-of-use electricity tariff periods. Mark off-peak groups to indicate
            when your battery charges from the grid at the cheapest rate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 24-hour visual timeline */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">24-Hour Coverage</p>
            <div className="flex h-7 overflow-hidden rounded-md border">
              {(() => {
                const hours = Array.from({ length: 24 }, (_, i) => {
                  const group = tariffGroups.find((g) =>
                    getTariffSlots(g).some((s) => {
                      if (s.startHour > s.endHour) return i >= s.startHour || i < s.endHour
                      return i >= s.startHour && i < s.endHour
                    })
                  )
                  return { hour: i, group }
                })
                return hours.map(({ hour, group }) => {
                  const colorMap: Record<string, string> = {
                    indigo: "bg-indigo-500/70",
                    sky: "bg-sky-500/70",
                    amber: "bg-amber-500/70",
                    red: "bg-red-500/70",
                    emerald: "bg-emerald-500/70",
                    violet: "bg-violet-500/70",
                    orange: "bg-orange-500/70",
                    rose: "bg-rose-500/70",
                    teal: "bg-teal-500/70",
                    slate: "bg-slate-500/70",
                  }
                  const bg = group ? (colorMap[group.color] || "bg-primary/40") : "bg-muted"
                  return (
                    <div
                      key={hour}
                      className={`flex flex-1 items-center justify-center text-[8px] font-medium text-white ${bg}`}
                      title={group ? `${group.name} (${currency.symbol}${group.rate}/kWh)` : `Uncovered`}
                    >
                      {hour % 6 === 0 ? `${hour}` : ""}
                    </div>
                  )
                })
              })()}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
              <span>12AM</span>
              <span>6AM</span>
              <span>12PM</span>
              <span>6PM</span>
              <span>12AM</span>
            </div>
          </div>

          {/* Group list */}
          <div className="space-y-3">
            {tariffGroups.map((group, idx) => {
              const colorOptions = [
                { value: "indigo", label: "Indigo" },
                { value: "sky", label: "Sky" },
                { value: "amber", label: "Amber" },
                { value: "red", label: "Red" },
                { value: "emerald", label: "Green" },
                { value: "violet", label: "Violet" },
                { value: "orange", label: "Orange" },
                { value: "rose", label: "Rose" },
                { value: "teal", label: "Teal" },
                { value: "slate", label: "Slate" },
              ]
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
              const slots = getTariffSlots(group)
              return (
                <div key={group.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full shrink-0 ${dotColorMap[group.color] || "bg-primary"}`} />
                    <Input
                      value={group.name}
                      onChange={(e) => {
                        const updated = [...tariffGroups]
                        updated[idx] = { ...group, name: e.target.value }
                        setTariffGroups(updated)
                        setTariffSaved(false)
                      }}
                      className="h-8 text-sm font-medium flex-1"
                      placeholder="Group name"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setTariffGroups(tariffGroups.filter((_, i) => i !== idx))
                        setTariffSaved(false)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Off-peak flag */}
                  <div className="flex items-center gap-2 pl-5">
                    <Checkbox
                      id={`offpeak-${group.id}`}
                      checked={group.isOffPeak === true}
                      onCheckedChange={(checked) => {
                        const updated = [...tariffGroups]
                        updated[idx] = { ...group, isOffPeak: checked === true }
                        setTariffGroups(updated)
                        setTariffSaved(false)
                      }}
                    />
                    <Label htmlFor={`offpeak-${group.id}`} className="text-xs text-muted-foreground">
                      Off-peak (cheap rate for battery charging)
                    </Label>
                  </div>

                  {/* Time slots */}
                  <div className="space-y-2 pl-5">
                    {slots.map((slot, sIdx) => (
                      <div key={sIdx} className="flex items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">From</Label>
                          <Select
                            value={String(slot.startHour)}
                            onValueChange={(v) => {
                              const newSlots = [...slots]
                              newSlots[sIdx] = { ...slot, startHour: parseInt(v, 10) }
                              const updated = [...tariffGroups]
                              updated[idx] = { ...group, slots: newSlots }
                              setTariffGroups(updated)
                              setTariffSaved(false)
                            }}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">To</Label>
                          <Select
                            value={String(slot.endHour)}
                            onValueChange={(v) => {
                              const newSlots = [...slots]
                              newSlots[sIdx] = { ...slot, endHour: parseInt(v, 10) }
                              const updated = [...tariffGroups]
                              updated[idx] = { ...group, slots: newSlots }
                              setTariffGroups(updated)
                              setTariffSaved(false)
                            }}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {slots.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const newSlots = slots.filter((_, si) => si !== sIdx)
                              const updated = [...tariffGroups]
                              updated[idx] = { ...group, slots: newSlots }
                              setTariffGroups(updated)
                              setTariffSaved(false)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => {
                        const newSlots = [...slots, { startHour: 0, endHour: 0 }]
                        const updated = [...tariffGroups]
                        updated[idx] = { ...group, slots: newSlots }
                        setTariffGroups(updated)
                        setTariffSaved(false)
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add time slot
                    </Button>
                  </div>

                  {/* Rate and color */}
                  <div className="flex flex-wrap items-end gap-3 pl-5">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Rate ({currency.symbol}/kWh)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={group.rate || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const updated = [...tariffGroups]
                          updated[idx] = { ...group, rate: parseFloat(e.target.value) || 0 }
                          setTariffGroups(updated)
                          setTariffSaved(false)
                        }}
                        className="w-24 h-8 text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Color</Label>
                      <Select
                        value={group.color}
                        onValueChange={(v) => {
                          const updated = [...tariffGroups]
                          updated[idx] = { ...group, color: v }
                          setTariffGroups(updated)
                          setTariffSaved(false)
                        }}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {colorOptions.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <span className="flex items-center gap-1.5">
                                <span className={`inline-block h-2 w-2 rounded-full ${dotColorMap[c.value] || "bg-primary"}`} />
                                {c.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add group */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const id = `group-${Date.now()}`
              setTariffGroups([
                ...tariffGroups,
                { id, name: "New Period", slots: [{ startHour: 0, endHour: 0 }], rate: 0, color: "slate" },
              ])
              setTariffSaved(false)
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add Tariff Period
          </Button>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                saveTariffGroups(tariffGroups)
                setTariffSaved(true)
                setTimeout(() => setTariffSaved(false), 3000)
              }}
            >
              Save Tariff Groups
            </Button>
            {tariffSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Saved -- reload inverter pages to apply
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Getting Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">
            How to Get API Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>
              Log in to{" "}
              <a
                href="https://www.soliscloud.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                SolisCloud <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Navigate to Service &rarr; API Management</li>
            <li>Generate or copy your API ID and API Secret</li>
            <li>Paste them in the login form when you first open this app</li>
          </ol>
        </CardContent>
      </Card>

      {/* Connected Stations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">
            Connected Power Stations
          </CardTitle>
          <CardDescription>
            Stations detected from your SolisCloud account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading stations...</p>
          ) : stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stations found. Connect your API credentials to see your stations.
            </p>
          ) : (
            <div className="space-y-2">
              {stations.map((station) => (
                <div
                  key={station.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{station.stationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {station.addr || "No address"} &middot; {station.capacity} {station.capacityStr}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-card-foreground">
                      {station.allEnergy?.toFixed(1)} {station.allEnergyStr}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Generation</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => mutate()}
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>
              SolisCloud Monitor &middot; Built on the SolisCloud Platform API v2.0.3
            </p>
            <p className="mt-1">
              Data refreshes automatically based on your configured interval. SolisCloud updates data every ~5 minutes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
