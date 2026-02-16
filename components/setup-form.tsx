"use client"

import { useState } from "react"
import { Sun, ExternalLink, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveCredentials } from "@/lib/solis-client"

export function SetupForm({ onComplete }: { onComplete: () => void }) {
  const [apiId, setApiId] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = apiId.trim().length > 0 && apiSecret.trim().length > 0

  async function handleConnect() {
    if (!canSubmit) return
    setTesting(true)
    setError("")
    try {
      const res = await fetch("/api/solis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-solis-api-id": apiId.trim(),
          "x-solis-api-secret": apiSecret.trim(),
        },
        body: JSON.stringify({
          endpoint: "/v1/api/userStationList",
          body: { pageNo: 1, pageSize: 1 },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(
          err.message || err.error || "Connection failed. Double-check your API ID and Secret."
        )
      }

      // Credentials work -- persist them
      saveCredentials(apiId.trim(), apiSecret.trim())
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
          <CardTitle className="text-2xl font-sans text-card-foreground">
            SolisCloud Monitor
          </CardTitle>
          <CardDescription>
            Enter your SolisCloud API credentials to get started.
            They are stored locally in your browser only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Where to get credentials */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-medium text-card-foreground">Where to find your credentials</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
              <li>
                Log in to{" "}
                <a
                  href="https://www.soliscloud.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
                >
                  SolisCloud <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Go to <span className="text-card-foreground">Service</span> &rarr;{" "}
                <span className="text-card-foreground">API Management</span>
              </li>
              <li>Copy your API ID and API Secret</li>
            </ol>
          </div>

          {/* Input fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id" className="text-card-foreground">API ID</Label>
              <Input
                id="api-id"
                placeholder="1300..."
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                autoComplete="off"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-secret" className="text-card-foreground">API Secret</Label>
              <div className="relative">
                <Input
                  id="api-secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="Your API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  autoComplete="off"
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-card-foreground"
                  aria-label={showSecret ? "Hide secret" : "Show secret"}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={!canSubmit || testing}
            className="w-full"
          >
            {testing ? "Connecting..." : "Connect"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Your credentials are stored in this browser only and sent securely per-request.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
