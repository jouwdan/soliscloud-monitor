"use client"

import { use } from "react"
import { AppShell } from "@/components/app-shell"
import { InverterDetailView } from "@/components/inverter-detail-view"

export default function InverterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sn?: string }>
}) {
  const { id } = use(params)
  const { sn } = use(searchParams)

  return (
    <AppShell>
      <InverterDetailView id={id} sn={sn || ""} />
    </AppShell>
  )
}
