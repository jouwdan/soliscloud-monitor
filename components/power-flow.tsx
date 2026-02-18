"use client"

import type { InverterDetail } from "@/lib/solis-client"
import { Sun, Home, Zap, Battery } from "lucide-react"

/* ─── constants ─── */
const SOLAR_COLOR = "#f59e0b" // amber-500
const GRID_COLOR = "#6b7280"  // gray-500
const HOME_COLOR = "#3b82f6"  // blue-500
const BATTERY_COLOR = "#22c55e" // green-500
const PV_STRING_COLOR = "#fbbf24" // amber-400

/* Dot size */
const DOT_R = 3

/* ─── animated dot group along an SVG path ─── */
function FlowDots({
  pathId,
  color,
  active,
  reverse = false,
  count = 3,
}: {
  pathId: string
  color: string
  active: boolean
  reverse?: boolean
  count?: number
}) {
  if (!active) return null
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <circle key={i} r={DOT_R} fill={color} opacity={0.9}>
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            begin={`${(i * (2 / count)).toFixed(2)}s`}
            keyPoints={reverse ? "1;0" : "0;1"}
            keyTimes="0;1"
            calcMode="linear"
          >
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  )
}

/* ─── SOC ring (circular progress arc) ─── */
function SocRing({ x, y, r, percent, color }: { x: number; y: number; r: number; percent: number; color: string }) {
  const circumference = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(100, percent))
  const offset = circumference - (filled / 100) * circumference
  return (
    <g>
      {/* Background track */}
      <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeWidth={3} opacity={0.1} />
      {/* Filled arc — starts from top (rotate -90) */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${x} ${y})`}
        className="transition-[stroke-dashoffset] duration-700 ease-in-out"
      />
    </g>
  )
}

/* ─── node bubble ─── */
function NodeBubble({
  x,
  y,
  icon: Icon,
  label,
  value,
  unit,
  color,
  sub,
  socPercent,
}: {
  x: number
  y: number
  icon: React.ElementType
  label: string
  value: string
  unit: string
  color: string
  sub?: string
  socPercent?: number
}) {
  const hasSoc = socPercent !== undefined
  return (
    <>
      {/* SVG ring — SOC arc for battery, plain circle for others */}
      {hasSoc ? (
        <SocRing x={x} y={y} r={50} percent={socPercent} color={color} />
      ) : (
        <circle cx={x} cy={y} r={50} fill="none" stroke={color} strokeWidth={2} opacity={0.6} />
      )}
      <foreignObject x={x - 48} y={y - 48} width={96} height={96}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card text-center">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</span>
          <span className="text-sm font-bold tabular-nums text-card-foreground leading-tight">{value}</span>
          <span className="text-[9px] text-muted-foreground">{unit}</span>
          {sub && <span className="text-[9px] text-muted-foreground leading-tight">{sub}</span>}
        </div>
      </foreignObject>
    </>
  )
}

/* ─── PV string pill ─── */
function PvStringPill({
  x,
  y,
  label,
  voltage,
  current,
  power,
}: {
  x: number
  y: number
  label: string
  voltage: number
  current: number
  power: number
}) {
  const active = power > 0.01
  return (
    <foreignObject x={x - 38} y={y - 16} width={76} height={32}>
      <div className={`flex h-full w-full flex-col items-center justify-center rounded-full border text-center ${active ? "border-amber-500/40 bg-amber-500/10" : "border-muted bg-muted/30"}`}>
        <span className="text-[8px] font-medium text-muted-foreground leading-none">{label}</span>
        <span className="text-[9px] font-bold tabular-nums text-card-foreground leading-none">
          {power > 0.01 ? `${power.toFixed(0)}W` : "—"}
        </span>
      </div>
    </foreignObject>
  )
}

/* ─── main component ─── */
export function PowerFlow({ detail }: { detail: InverterDetail }) {
  const solarPower = detail.pac || 0
  const gridPower = detail.pSum || 0           // positive = import, negative = export
  const batteryPower = detail.batteryPower || 0 // positive = charging, negative = discharging
  const homePower = detail.familyLoadPower || 0
  const batterySoc = detail.batteryCapacitySoc || 0
  const hasBattery = Boolean(
    detail.batteryPower !== undefined &&
    (detail.batteryCapacitySoc || detail.batteryTotalChargeEnergy || detail.batteryTotalDischargeEnergy)
  )

  /* PV strings — detect how many are active based on dcInputType and actual values */
  const pvStrings: { label: string; voltage: number; current: number; power: number }[] = []
  const pvData = [
    { v: detail.uPv1 || 0, i: detail.iPv1 || 0, p: detail.pow1 || 0 },
    { v: detail.uPv2 || 0, i: detail.iPv2 || 0, p: detail.pow2 || 0 },
    { v: detail.uPv3 || 0, i: detail.iPv3 || 0, p: detail.pow3 || 0 },
    { v: detail.uPv4 || 0, i: detail.iPv4 || 0, p: detail.pow4 || 0 },
  ]
  const dcInputType = detail.dcInputType || 2
  for (let i = 0; i < Math.min(dcInputType, 4); i++) {
    pvStrings.push({
      label: `PV${i + 1}`,
      voltage: pvData[i].v,
      current: pvData[i].i,
      power: pvData[i].p,
    })
  }
  const hasStrings = pvStrings.length > 0

  /* Whether each flow is active (power > small threshold)
     Solis convention: negative pSum = importing from grid, positive = exporting */
  const solarActive = solarPower > 0.01
  const gridImporting = gridPower < -0.01
  const gridExporting = gridPower > 0.01
  const batteryCharging = batteryPower > 0.01
  const batteryDischarging = batteryPower < -0.01
  const homeActive = homePower > 0.01

  /* Node positions — viewBox is 400 x 460 when strings shown, 400 x 400 otherwise */
  const stringRowY = 20      // y-centre of PV string pills
  const yOffset = hasStrings ? 60 : 0 // push main diagram down when strings present
  const cx = 200
  const cy = 200 + yOffset
  const solar = { x: cx, y: 52 + yOffset }
  const home = { x: 348, y: cy }
  const grid = { x: cx, y: 348 + yOffset }
  const battery = { x: 52, y: cy }
  const viewH = 400 + yOffset

  /* Line opacity helpers */
  const solarToHome = solarActive && homeActive
  const solarToBattery = solarActive && hasBattery && batteryCharging
  const solarToGrid = solarActive && gridExporting
  const gridToHome = gridImporting && homeActive
  const batteryToHome = hasBattery && batteryDischarging && homeActive

  return (
    <div className="relative mx-auto w-full max-w-md" style={{ aspectRatio: `400 / ${viewH}` }}>
      <svg
        viewBox={`0 0 400 ${viewH}`}
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
      >
        {/* ─── PV Strings → Solar ─── */}
        {hasStrings && (() => {
          const count = pvStrings.length
          const spacing = 84
          const totalW = (count - 1) * spacing
          const startX = cx - totalW / 2
          return (
            <>
              {pvStrings.map((s, i) => {
                const px = startX + i * spacing
                const active = s.power > 0.01
                const pathId = `path-pv${i + 1}-solar`
                return (
                  <g key={i}>
                    <path
                      id={pathId}
                      d={`M ${px} ${stringRowY + 16} L ${solar.x} ${solar.y - 50}`}
                      fill="none"
                      stroke={PV_STRING_COLOR}
                      strokeWidth={active ? 1.5 : 1}
                      strokeDasharray={active ? "none" : "3 3"}
                      opacity={active ? 0.4 : 0.1}
                    />
                    {active && <FlowDots pathId={pathId} color={PV_STRING_COLOR} active count={2} />}
                    <PvStringPill
                      x={px}
                      y={stringRowY}
                      label={s.label}
                      voltage={s.voltage}
                      current={s.current}
                      power={s.power}
                    />
                  </g>
                )
              })}
            </>
          )
        })()}

        {/* ─── Paths (invisible references for animateMotion) ─── */}
        {/* Solar → Home (curve right) */}
        <path
          id="path-solar-home"
          d={`M ${solar.x} ${solar.y} Q ${home.x} ${solar.y} ${home.x} ${home.y}`}
          fill="none"
          stroke={SOLAR_COLOR}
          strokeWidth={solarToHome ? 2 : 1}
          strokeDasharray={solarToHome ? "none" : "4 4"}
          opacity={solarToHome ? 0.5 : 0.12}
        />
        {/* Solar → Battery (curve left) */}
        {hasBattery && (
          <path
            id="path-solar-battery"
            d={`M ${solar.x} ${solar.y} Q ${battery.x} ${solar.y} ${battery.x} ${battery.y}`}
            fill="none"
            stroke={SOLAR_COLOR}
            strokeWidth={solarToBattery ? 2 : 1}
            strokeDasharray={solarToBattery ? "none" : "4 4"}
            opacity={solarToBattery ? 0.5 : 0.12}
          />
        )}
        {/* Solar → Grid (straight down, slight curve) */}
        <path
          id="path-solar-grid"
          d={`M ${solar.x} ${solar.y} L ${grid.x} ${grid.y}`}
          fill="none"
          stroke={solarToGrid ? SOLAR_COLOR : GRID_COLOR}
          strokeWidth={solarToGrid ? 2 : 1}
          strokeDasharray={solarToGrid ? "none" : "4 4"}
          opacity={solarToGrid ? 0.5 : 0.12}
        />
        {/* Grid → Home (curve right-bottom) */}
        <path
          id="path-grid-home"
          d={`M ${grid.x} ${grid.y} Q ${home.x} ${grid.y} ${home.x} ${home.y}`}
          fill="none"
          stroke={GRID_COLOR}
          strokeWidth={gridToHome ? 2 : 1}
          strokeDasharray={gridToHome ? "none" : "4 4"}
          opacity={gridToHome ? 0.5 : 0.12}
        />
        {/* Battery → Home (straight across, slight curve) */}
        {hasBattery && (
          <path
            id="path-battery-home"
            d={`M ${battery.x} ${battery.y} L ${home.x} ${home.y}`}
            fill="none"
            stroke={BATTERY_COLOR}
            strokeWidth={batteryToHome ? 2 : 1}
            strokeDasharray={batteryToHome ? "none" : "4 4"}
            opacity={batteryToHome ? 0.5 : 0.12}
          />
        )}
        {/* Grid → Battery (curve left-bottom) */}
        {hasBattery && (
          <path
            id="path-grid-battery"
            d={`M ${grid.x} ${grid.y} Q ${battery.x} ${grid.y} ${battery.x} ${battery.y}`}
            fill="none"
            stroke={GRID_COLOR}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.12}
          />
        )}

        {/* ─── Animated dots ─── */}
        <FlowDots pathId="path-solar-home" color={SOLAR_COLOR} active={solarToHome} />
        {hasBattery && <FlowDots pathId="path-solar-battery" color={SOLAR_COLOR} active={solarToBattery} />}
        <FlowDots pathId="path-solar-grid" color={SOLAR_COLOR} active={solarToGrid} />
        <FlowDots pathId="path-grid-home" color={GRID_COLOR} active={gridToHome} />
        {hasBattery && <FlowDots pathId="path-battery-home" color={BATTERY_COLOR} active={batteryToHome} />}

        {/* ─── Nodes ─── */}
        <NodeBubble
          x={solar.x}
          y={solar.y}
          icon={Sun}
          label="Solar"
          value={solarPower.toFixed(2)}
          unit={detail.pacStr || "kW"}
          color={SOLAR_COLOR}
        />
        <NodeBubble
          x={home.x}
          y={home.y}
          icon={Home}
          label="Home"
          value={homePower.toFixed(2)}
          unit={detail.familyLoadPowerStr || "kW"}
          color={HOME_COLOR}
        />
        <NodeBubble
          x={grid.x}
          y={grid.y}
          icon={Zap}
          label="Grid"
          value={Math.abs(gridPower).toFixed(2)}
          unit={detail.pSumStr || "kW"}
          color={GRID_COLOR}
          sub={gridImporting ? "Importing" : gridExporting ? "Exporting" : "Idle"}
        />
        {hasBattery && (
          <NodeBubble
            x={battery.x}
            y={battery.y}
            icon={Battery}
            label="Battery"
            value={Math.abs(batteryPower).toFixed(2)}
            unit={detail.batteryPowerStr || "kW"}
            color={BATTERY_COLOR}
            sub={`${batterySoc.toFixed(0)}% SOC`}
            socPercent={batterySoc}
          />
        )}
      </svg>
    </div>
  )
}
