"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { DashboardOverview } from "@/components/dashboard-overview"
import { SetupForm } from "@/components/setup-form"
import { getSavedCredentials } from "@/lib/solis-client"

export default function HomePage() {
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null)

  useEffect(() => {
    setHasCredentials(getSavedCredentials() !== null)
  }, [])

  // Still checking localStorage (only 1 frame)
  if (hasCredentials === null) return null

  if (!hasCredentials) {
    return (
      <SetupForm
        onComplete={() => setHasCredentials(true)}
      />
    )
  }

  return (
    <AppShell>
      <DashboardOverview />
    </AppShell>
  )
}
