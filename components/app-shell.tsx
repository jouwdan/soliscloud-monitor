"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sun,
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  Settings,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getRefreshSeconds } from "@/lib/solis-client"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inverters", label: "Inverters", icon: Cpu },
  { href: "/alarms", label: "Alarms", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const secs = getRefreshSeconds()
  const refreshLabel = secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs}s`

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Sun className="h-5 w-5 text-sidebar-primary" />
          <span className="font-sans text-sm font-semibold text-sidebar-foreground">
            SolisCloud Monitor
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <p className="text-xs text-muted-foreground">
            Data refreshes every {refreshLabel}
          </p>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:hidden",
          mobileOpen ? "flex translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-sidebar-primary" />
            <span className="font-sans text-sm font-semibold text-sidebar-foreground">
              SolisCloud
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar - mobile */}
        <header className="flex h-14 items-center gap-3 border-b px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Sun className="h-5 w-5 text-primary" />
          <span className="font-sans text-sm font-semibold">
            SolisCloud Monitor
          </span>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
