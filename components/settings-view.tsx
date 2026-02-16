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
import {
  useStationList,
  getSavedCredentials,
  clearCredentials,
  getRefreshSeconds,
  saveRefreshSeconds,
} from "@/lib/solis-client"

export function SettingsView() {
  const router = useRouter()
  const { data: stationData, isLoading, mutate } = useStationList()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)
  const creds = getSavedCredentials()
  const [refreshSeconds, setRefreshSeconds] = useState(() => getRefreshSeconds())
  const [refreshSaved, setRefreshSaved] = useState(false)

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
            <li>Navigate to Account &rarr; Basic Settings &rarr; API Management</li>
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
