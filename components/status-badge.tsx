import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  state: number
  className?: string
}

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const config: Record<number, { label: string; dotClass: string; bgClass: string }> = {
    1: {
      label: "Online",
      dotClass: "bg-emerald-500",
      bgClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    2: {
      label: "Offline",
      dotClass: "bg-muted-foreground",
      bgClass: "bg-muted text-muted-foreground",
    },
    3: {
      label: "Alarm",
      dotClass: "bg-destructive",
      bgClass: "bg-destructive/10 text-destructive",
    },
  }

  const { label, dotClass, bgClass } = config[state] || config[2]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        bgClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      {label}
    </span>
  )
}
