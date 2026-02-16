"use client"

import { AppShell } from "@/components/app-shell"
import { InverterListView } from "@/components/inverter-list-view"

export default function InvertersPage() {
  return (
    <AppShell>
      <InverterListView />
    </AppShell>
  )
}
