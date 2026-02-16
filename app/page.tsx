"use client"

import { AppShell } from "@/components/app-shell"
import { DashboardOverview } from "@/components/dashboard-overview"
import { SetupForm } from "@/components/setup-form"
import { useConnectionStatus } from "@/lib/solis-client"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  const { configured, isLoading, recheck } = useConnectionStatus()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!configured) {
    return <SetupForm onComplete={() => recheck()} />
  }

  return (
    <AppShell>
      <DashboardOverview />
    </AppShell>
  )
}
