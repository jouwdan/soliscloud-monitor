"use client"

import { useState } from "react"
import { Sun, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SetupForm({ onComplete }: { onComplete: () => void }) {
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState("")

  async function handleTest() {
    setTesting(true)
    setError("")
    try {
      // First check if the server now sees the env vars
      const statusRes = await fetch("/api/solis")
      const status = await statusRes.json()

      if (!status.configured) {
        throw new Error(
          "Environment variables not detected. Please add SOLIS_API_ID and SOLIS_API_SECRET in the Vars section of the sidebar, then try again."
        )
      }

      // Env vars are set — verify they actually work by making a real API call
      const res = await fetch("/api/solis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "/v1/api/userStationList",
          body: { pageNo: 1, pageSize: 1 },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Connection failed — check your API credentials.")
      }
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sun className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-sans text-card-foreground">SolisCloud Monitor</CardTitle>
          <CardDescription>
            Connect your SolisCloud account to monitor your solar inverters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <h3 className="text-sm font-medium text-card-foreground">Setup Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Log in to{" "}
                <a
                  href="https://www.soliscloud.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                >
                  SolisCloud <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Go to Account &rarr; Basic Settings &rarr; API Management</li>
              <li>Copy your <span className="font-mono text-card-foreground">API ID</span> and <span className="font-mono text-card-foreground">API Secret</span></li>
              <li>
                Add them as environment variables in the{" "}
                <span className="font-medium text-card-foreground">Vars</span> section of the sidebar:
              </li>
            </ol>
            <div className="rounded-md bg-card border border-border p-3 font-mono text-xs text-muted-foreground space-y-1">
              <div><span className="text-primary">SOLIS_API_ID</span> = your-api-id</div>
              <div><span className="text-primary">SOLIS_API_SECRET</span> = your-api-secret</div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button onClick={handleTest} disabled={testing} className="w-full">
            {testing ? "Testing Connection..." : "Test Connection"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
