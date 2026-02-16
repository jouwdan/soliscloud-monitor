"use client"

import { useState } from "react"
import { Sun, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStationList } from "@/lib/solis-client"

export function SettingsView() {
  const { data: stationData, isLoading, mutate } = useStationList()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/solis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const stations = stationData?.page?.records || []

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
            Your API credentials are managed via environment variables for security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">API ID</p>
              <p className="mt-1 font-mono text-xs text-card-foreground">
                SOLIS_API_ID
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set via environment variable
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">API Secret</p>
              <p className="mt-1 font-mono text-xs text-card-foreground">
                SOLIS_API_SECRET
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set via environment variable
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
            {testResult === "success" && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Connection successful
              </span>
            )}
            {testResult === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Connection failed. Check your credentials.
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
            <li>Navigate to Account &rarr; Basic Settings &rarr; API Management</li>
            <li>Generate or copy your API ID and API Secret</li>
            <li>
              Add them as environment variables:
              <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-card-foreground">
                SOLIS_API_ID
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-card-foreground">
                SOLIS_API_SECRET
              </code>
            </li>
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
              Data refreshes automatically every 5 minutes, matching the SolisCloud update frequency.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
