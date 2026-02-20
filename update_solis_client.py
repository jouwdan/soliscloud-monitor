import re

file_path = 'lib/solis-client.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Define the search block (using regex or exact string)
search_block = r"""export interface TariffGroup \{
  id: string
  name: string
  /\*\* @deprecated single slot kept for backwards compat -- prefer `slots` \*/
  startHour: number
  /\*\* @deprecated single slot kept for backwards compat -- prefer `slots` \*/
  endHour: number
  rate: number // currency/kWh
  color: string // tailwind-compatible colour for UI
  slots\?: TariffTimeSlot\[\]
  isOffPeak\?: boolean
\}

/\*\* Get the effective time slots for a tariff group \(handles legacy single-slot format\) \*/
export function getTariffSlots\(g: TariffGroup\): TariffTimeSlot\[\] \{
  if \(g.slots && g.slots.length > 0\) return g.slots
  return \[\{ startHour: g.startHour, endHour: g.endHour \}\]
\}

export interface OffPeakSettings \{
  startHour: number
  endHour: number
  tariffGroups: TariffGroup\[\]
  /\*\* @deprecated kept for backwards compat reading \*/
  peakRate: number
  offpeakRate: number
\}

const STORAGE_KEY_OFFPEAK = "solis_offpeak_settings"
const STORAGE_KEY_TARIFF_GROUPS = "solis_tariff_groups"

const DEFAULT_TARIFF_GROUPS: TariffGroup\[\] = \[
  \{ id: "off-peak", name: "Off-Peak", startHour: 23, endHour: 6, rate: 0, color: "indigo", isOffPeak: true \},
  \{ id: "standard", name: "Standard", startHour: 6, endHour: 7, rate: 0, color: "sky" \},
  \{ id: "peak", name: "Peak", startHour: 7, endHour: 10, rate: 0, color: "amber" \},
  \{ id: "standard-mid", name: "Standard", startHour: 10, endHour: 18, rate: 0, color: "sky" \},
  \{ id: "peak-eve", name: "Peak", startHour: 18, endHour: 20, rate: 0, color: "amber" \},
  \{ id: "standard-eve", name: "Standard", startHour: 20, endHour: 23, rate: 0, color: "sky" \},
\]

export function getOffPeakSettings\(\): OffPeakSettings \{
  const defaults: OffPeakSettings = \{
    startHour: 23,
    endHour: 8,
    tariffGroups: DEFAULT_TARIFF_GROUPS,
    peakRate: 0,
    offpeakRate: 0,
  \}
  if \(typeof window === "undefined"\) return defaults
  try \{
    const raw = localStorage.getItem\(STORAGE_KEY_OFFPEAK\)
    if \(raw\) \{
      const parsed = JSON.parse\(raw\)
      const merged = \{ ...defaults, ...parsed \}
      if \(Array.isArray\(merged.tariffGroups\)\) \{
        merged.tariffGroups = migrateOffPeakFlag\(merged.tariffGroups\)
      \} else \{
        merged.tariffGroups = DEFAULT_TARIFF_GROUPS
      \}
      return merged
    \}
    // migrate old keys
    const start = localStorage.getItem\("solis_offpeak_start"\)
    const end = localStorage.getItem\("solis_offpeak_end"\)
    if \(start\) defaults.startHour = parseInt\(start, 10\) || 23
    if \(end\) defaults.endHour = parseInt\(end, 10\) || 8
  \} catch \{ /\* ignore \*/ \}
  return defaults
\}

export function saveOffPeakSettings\(s: OffPeakSettings\) \{
  localStorage.setItem\(STORAGE_KEY_OFFPEAK, JSON.stringify\(s\)\)
\}

/\*\* Migrate legacy groups that lack the `isOffPeak` flag by inferring from the name \*/
function migrateOffPeakFlag\(groups: TariffGroup\[\]\): TariffGroup\[\] \{
  return groups.map\(\(g\) => \(\{
    ...g,
    isOffPeak: g.isOffPeak \?\? /off.?peak\|night/i.test\(g.name\),
  \}\)\)
\}

export function getTariffGroups\(\): TariffGroup\[\] \{
  if \(typeof window === "undefined"\) return DEFAULT_TARIFF_GROUPS
  try \{
    const raw = localStorage.getItem\(STORAGE_KEY_TARIFF_GROUPS\)
    if \(raw\) \{
      const parsed = JSON.parse\(raw\)
      if \(Array.isArray\(parsed\) && parsed.length > 0\) return migrateOffPeakFlag\(parsed\)
    \}
  \} catch \{ /\* ignore \*/ \}
  return DEFAULT_TARIFF_GROUPS
\}"""

replace_block = """export interface TariffGroup {
  id: string
  name: string
  rate: number // currency/kWh
  color: string // tailwind-compatible colour for UI
  slots: TariffTimeSlot[]
  isOffPeak?: boolean
}

/** Get the effective time slots for a tariff group (legacy helper retained for compatibility) */
export function getTariffSlots(g: TariffGroup): TariffTimeSlot[] {
  return g.slots
}

export interface OffPeakSettings {
  startHour: number
  endHour: number
  tariffGroups: TariffGroup[]
  /** @deprecated kept for backwards compat reading */
  peakRate: number
  offpeakRate: number
}

const STORAGE_KEY_OFFPEAK = "solis_offpeak_settings"
const STORAGE_KEY_TARIFF_GROUPS = "solis_tariff_groups"

const DEFAULT_TARIFF_GROUPS: TariffGroup[] = [
  { id: "off-peak", name: "Off-Peak", rate: 0, color: "indigo", isOffPeak: true, slots: [{ startHour: 23, endHour: 6 }] },
  { id: "standard", name: "Standard", rate: 0, color: "sky", slots: [{ startHour: 6, endHour: 7 }] },
  { id: "peak", name: "Peak", rate: 0, color: "amber", slots: [{ startHour: 7, endHour: 10 }] },
  { id: "standard-mid", name: "Standard", rate: 0, color: "sky", slots: [{ startHour: 10, endHour: 18 }] },
  { id: "peak-eve", name: "Peak", rate: 0, color: "amber", slots: [{ startHour: 18, endHour: 20 }] },
  { id: "standard-eve", name: "Standard", rate: 0, color: "sky", slots: [{ startHour: 20, endHour: 23 }] },
]

export function getOffPeakSettings(): OffPeakSettings {
  const defaults: OffPeakSettings = {
    startHour: 23,
    endHour: 8,
    tariffGroups: DEFAULT_TARIFF_GROUPS,
    peakRate: 0,
    offpeakRate: 0,
  }
  if (typeof window === "undefined") return defaults
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFPEAK)
    if (raw) {
      const parsed = JSON.parse(raw)
      const merged = { ...defaults, ...parsed }
      if (Array.isArray(merged.tariffGroups)) {
        merged.tariffGroups = migrateTariffGroups(merged.tariffGroups)
      } else {
        merged.tariffGroups = DEFAULT_TARIFF_GROUPS
      }
      return merged
    }
    // migrate old keys
    const start = localStorage.getItem("solis_offpeak_start")
    const end = localStorage.getItem("solis_offpeak_end")
    if (start) defaults.startHour = parseInt(start, 10) || 23
    if (end) defaults.endHour = parseInt(end, 10) || 8
  } catch { /* ignore */ }
  return defaults
}

export function saveOffPeakSettings(s: OffPeakSettings) {
  localStorage.setItem(STORAGE_KEY_OFFPEAK, JSON.stringify(s))
}

/** Migrate legacy groups (missing slots or off-peak flag) to new format */
function migrateTariffGroups(groups: any[]): TariffGroup[] {
  return groups.map((g) => {
    // 1. Ensure slots exist
    let slots = g.slots
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      if (typeof g.startHour === "number" && typeof g.endHour === "number") {
        slots = [{ startHour: g.startHour, endHour: g.endHour }]
      } else {
        slots = [] // Should ideally not happen for valid data
      }
    }

    // 2. Ensure isOffPeak flag is present (migrate from name heuristic if missing)
    const isOffPeak = g.isOffPeak ?? /off.?peak|night/i.test(g.name || "")

    // Return clean object without deprecated fields
    return {
      id: g.id,
      name: g.name,
      rate: g.rate,
      color: g.color,
      slots,
      isOffPeak,
    }
  })
}

export function getTariffGroups(): TariffGroup[] {
  if (typeof window === "undefined") return DEFAULT_TARIFF_GROUPS
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TARIFF_GROUPS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return migrateTariffGroups(parsed)
    }
  } catch { /* ignore */ }
  return DEFAULT_TARIFF_GROUPS
}"""

# Use simple string replacement but we need to match carefully.
# Since I copied the text from read_file, it should match if line endings are same.
# If not, I'll fallback to regex.

new_content = content.replace(search_block.replace(r'\{', '{').replace(r'\}', '}').replace(r'\*', '*').replace(r'\(', '(').replace(r'\)', ')').replace(r'\[', '[').replace(r'\]', ']').replace(r'\?', '?').replace(r'\|', '|').replace(r'\.', '.'), replace_block)

if content == new_content:
    print("No replacement made. Check search block.")
    # Debug: print snippet
    print("Content snippet:", content[1000:1500])
else:
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Replacement successful.")
