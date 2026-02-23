import useSWR from "swr"

// --------- Credential helpers (localStorage) ----------

const STORAGE_KEY_ID = "solis_api_id"
const STORAGE_KEY_SECRET = "solis_api_secret"

export function getSavedCredentials(): {
  apiId: string
  apiSecret: string
} | null {
  if (typeof window === "undefined") return null
  const apiId = localStorage.getItem(STORAGE_KEY_ID)
  const apiSecret = localStorage.getItem(STORAGE_KEY_SECRET)
  if (apiId && apiSecret) return { apiId, apiSecret }
  return null
}

export function saveCredentials(apiId: string, apiSecret: string) {
  localStorage.setItem(STORAGE_KEY_ID, apiId)
  localStorage.setItem(STORAGE_KEY_SECRET, apiSecret)
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY_ID)
  localStorage.removeItem(STORAGE_KEY_SECRET)
}

// --------- Refresh interval helpers (localStorage) ----------

const STORAGE_KEY_REFRESH = "solis_refresh_seconds"
const DEFAULT_REFRESH_SECONDS = 300

export function getRefreshSeconds(): number {
  if (typeof window === "undefined") return DEFAULT_REFRESH_SECONDS
  const stored = localStorage.getItem(STORAGE_KEY_REFRESH)
  if (!stored) return DEFAULT_REFRESH_SECONDS
  const parsed = parseInt(stored, 10)
  if (isNaN(parsed) || parsed < 10) return DEFAULT_REFRESH_SECONDS
  return parsed
}

export function saveRefreshSeconds(seconds: number) {
  localStorage.setItem(STORAGE_KEY_REFRESH, String(Math.max(10, seconds)))
}

export function getRefreshMs(): number {
  return getRefreshSeconds() * 1000
}

// --------- Tariff & off-peak helpers (localStorage) ----------

export interface TariffTimeSlot {
  startHour: number
  endHour: number
}

export interface TariffGroup {
  id: string
  name: string
  /** @deprecated single slot kept for backwards compat -- prefer `slots` */
  startHour: number
  /** @deprecated single slot kept for backwards compat -- prefer `slots` */
  endHour: number
  rate: number // currency/kWh
  color: string // tailwind-compatible colour for UI
  slots?: TariffTimeSlot[]
  isOffPeak?: boolean
}

/** Get the effective time slots for a tariff group (handles legacy single-slot format) */
export function getTariffSlots(g: TariffGroup): TariffTimeSlot[] {
  if (g.slots && g.slots.length > 0) return g.slots
  return [{ startHour: g.startHour, endHour: g.endHour }]
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
  { id: "off-peak", name: "Off-Peak", startHour: 23, endHour: 6, rate: 0, color: "indigo", isOffPeak: true },
  { id: "standard", name: "Standard", startHour: 6, endHour: 7, rate: 0, color: "sky" },
  { id: "peak", name: "Peak", startHour: 7, endHour: 10, rate: 0, color: "amber" },
  { id: "standard-mid", name: "Standard", startHour: 10, endHour: 18, rate: 0, color: "sky" },
  { id: "peak-eve", name: "Peak", startHour: 18, endHour: 20, rate: 0, color: "amber" },
  { id: "standard-eve", name: "Standard", startHour: 20, endHour: 23, rate: 0, color: "sky" },
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
        merged.tariffGroups = migrateOffPeakFlag(merged.tariffGroups)
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

/** Migrate legacy groups that lack the `isOffPeak` flag by inferring from the name */
function migrateOffPeakFlag(groups: TariffGroup[]): TariffGroup[] {
  return groups.map((g) => ({
    ...g,
    isOffPeak: g.isOffPeak ?? /off.?peak|night/i.test(g.name),
  }))
}

export function getTariffGroups(): TariffGroup[] {
  if (typeof window === "undefined") return DEFAULT_TARIFF_GROUPS
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TARIFF_GROUPS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return migrateOffPeakFlag(parsed)
    }
  } catch { /* ignore */ }
  return DEFAULT_TARIFF_GROUPS
}

export function saveTariffGroups(groups: TariffGroup[]) {
  localStorage.setItem(STORAGE_KEY_TARIFF_GROUPS, JSON.stringify(groups))
}

export function isOffPeakHour(hour: number, groups?: TariffGroup[]): boolean {
  // Use the persisted tariff groups (which include the off-peak flags from the UI)
  const effectiveGroups = groups || getTariffGroups()
  const matched = getTariffForHour(hour, effectiveGroups)
  return matched?.isOffPeak === true
}

function slotContainsHour(slot: TariffTimeSlot, hour: number): boolean {
  if (slot.startHour > slot.endHour) {
    return hour >= slot.startHour || hour < slot.endHour
  }
  return hour >= slot.startHour && hour < slot.endHour
}

/** Find the tariff group that applies to a given hour.
 *  When multiple groups match (overlapping slots), prefer the most specific
 *  (shortest total hours) to avoid a broad group shadowing a narrow one. */
export function getTariffForHour(hour: number, groups: TariffGroup[]): TariffGroup | undefined {
  let best: TariffGroup | undefined
  let bestHours = Infinity
  for (const g of groups) {
    const slots = getTariffSlots(g)
    if (!slots.some((s) => slotContainsHour(s, hour))) continue
    // Sum the total hours this group covers
    let totalH = 0
    for (const s of slots) {
      totalH += s.endHour > s.startHour
        ? s.endHour - s.startHour
        : (24 - s.startHour) + s.endHour
    }
    if (totalH < bestHours) {
      best = g
      bestHours = totalH
    }
  }
  return best
}

/** Get the rate in c/kWh for a given hour */
export function getRateForHour(hour: number, groups: TariffGroup[]): number {
  return getTariffForHour(hour, groups)?.rate || 0
}

// --------- Currency helpers (localStorage) ----------

const STORAGE_KEY_CURRENCY = "solis_currency"

export interface CurrencySettings {
  symbol: string
  code: string
}

const CURRENCY_OPTIONS: CurrencySettings[] = [
  { symbol: "\u20AC", code: "EUR" },
  { symbol: "$", code: "USD" },
  { symbol: "\u00A3", code: "GBP" },
  { symbol: "R", code: "ZAR" },
  { symbol: "A$", code: "AUD" },
  { symbol: "C$", code: "CAD" },
  { symbol: "CHF", code: "CHF" },
  { symbol: "\u00A5", code: "JPY" },
  { symbol: "\u20B9", code: "INR" },
  { symbol: "R$", code: "BRL" },
]

export { CURRENCY_OPTIONS }

export function getCurrencySettings(): CurrencySettings {
  if (typeof window === "undefined") return CURRENCY_OPTIONS[0]
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENCY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return CURRENCY_OPTIONS[0]
}

export function saveCurrencySettings(c: CurrencySettings) {
  localStorage.setItem(STORAGE_KEY_CURRENCY, JSON.stringify(c))
}

// --------- Export price helpers (localStorage) ----------

const STORAGE_KEY_EXPORT_PRICE = "solis_export_price"

export function getExportPrice(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPORT_PRICE)
    if (raw) {
      const parsed = parseFloat(raw)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
  } catch { /* ignore */ }
  return 0
}

export function saveExportPrice(price: number) {
  localStorage.setItem(STORAGE_KEY_EXPORT_PRICE, String(Math.max(0, price)))
}

// --------- Unit normalisation helpers ----------

/**
 * Normalise a power reading to kW.
 *
 * Solis day-graph entries return raw integer values (e.g. pac: 5000)
 * alongside a precision/multiplier field (e.g. pacPec: "0.001").
 * The formula is:  value * pec = kW
 *
 * When the pec field is available we use it directly.
 * When it's not, we check the Str field:
 *   - "W"  → divide by 1000
 *   - "kW" → use as-is
 * As a final heuristic, if the Str says "kW" but the value is > 100
 * (impossible for a residential inverter in kW), we treat it as Watts.
 */
export function toKW(
  value: number | undefined,
  unitStr: string | undefined,
  pec?: string | number | undefined
): number {
  if (value === undefined || value === null) return 0

  // If pec (precision multiplier) is provided, use it: value * pec = kW
  if (pec !== undefined && pec !== null && pec !== "") {
    const multiplier = typeof pec === "number" ? pec : parseFloat(String(pec))
    if (!isNaN(multiplier) && multiplier > 0 && multiplier < 1) {
      return value * multiplier
    }
  }

  const u = (unitStr || "").toLowerCase().replace(/\s/g, "")
  if (u === "w" || u === "watt" || u === "watts") return value / 1000
  if (u === "mw") return value * 1000
  if (u === "gw") return value * 1000000

  // "kw" or anything else → assume already kW

  return value
}

/**
 * Normalise an energy value to **kWh**.
 * The Solis API returns energy in whatever unit it likes and puts the unit
 * label in the companion `*Str` field (e.g. "kWh", "MWh", "Wh", "GWh").
 * If the unit string is missing or unrecognised we fall back to kWh.
 */
export function toKWh(
  value: number | undefined,
  unitStr: string | undefined
): number {
  if (value === undefined || value === null) return 0
  const u = (unitStr || "").toLowerCase().replace(/\s/g, "")
  if (u.startsWith("mwh")) return value * 1000
  if (u.startsWith("gwh")) return value * 1_000_000
  if (u.startsWith("wh") && !u.startsWith("whi")) return value / 1000
  // "kwh" or anything else → assume already kWh
  return value
}

type GridPowerLike = {
  pSum?: number
  pSumStr?: string
  psum?: number
  psumStr?: string
  psumCal?: number
  psumCalStr?: string
  pSumCal?: number
  pSumCalStr?: string
}

export function pickGridPower(entry: GridPowerLike): { value: number; unit?: string } {
  const candidates = [
    { value: entry.pSum, unit: entry.pSumStr },
    { value: entry.psum, unit: entry.psumStr },
    { value: entry.psumCal, unit: entry.psumCalStr },
    { value: entry.pSumCal, unit: entry.pSumCalStr },
  ]
  const pick =
    candidates.find((c) => typeof c.value === "number" && Math.abs(c.value || 0) > 0) ||
    candidates.find((c) => typeof c.value === "number") ||
    { value: 0, unit: undefined }
  return { value: pick.value || 0, unit: pick.unit }
}

export function pickGridPowerPec(
  entry: Record<string, unknown>,
  fallback?: string
): string | undefined {
  const raw = entry as {
    pSumPec?: string
    psumPec?: string
    psumCalPec?: string
    pSumCalPec?: string
  }
  return raw.psumPec ?? raw.psumCalPec ?? raw.pSumPec ?? raw.pSumCalPec ?? fallback
}

// ---------- Generic fetcher ----------

async function solisFetcher<T = unknown>([endpoint, body]: [
  string,
  Record<string, unknown>,
]): Promise<T> {
  const creds = getSavedCredentials()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (creds) {
    headers["x-solis-api-id"] = creds.apiId
    headers["x-solis-api-secret"] = creds.apiSecret
  }

  const res = await fetch("/api/solis", {
    method: "POST",
    headers,
    body: JSON.stringify({ endpoint, body }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "API request failed")
  }

  const json = await res.json()
  return json.data as T
}

export function useSolisApi<T = unknown>(
  endpoint: string | null,
  body: Record<string, unknown> = {},
  options: { refreshInterval?: number; revalidateOnFocus?: boolean } = {}
) {
  return useSWR<T>(
    endpoint ? [endpoint, body] : null,
    solisFetcher,
    {
      refreshInterval: options.refreshInterval ?? getRefreshMs(),
      revalidateOnFocus: options.revalidateOnFocus ?? false,
      dedupingInterval: Math.min(10000, getRefreshMs()),
    }
  )
}

// --- Typed hooks ---

export interface InverterListData {
  inverterStatusVo: {
    all: number
    normal: number
    fault: number
    offline: number
  }
  page: {
    records: InverterRecord[]
    total: number
    size: number
    current: number
    pages: number
  }
}

export interface InverterRecord {
  id: string
  sn: string
  stationId: string
  stationName?: string
  power: number
  powerStr: string
  pac: number
  pacStr: string
  etoday: number
  etodayStr: string
  etotal: number
  etotalStr: string
  state: number
  dataTimestamp: string
  collectorSn?: string
  productModel?: string
  dcInputType?: number
  acOutputType?: number
  series?: string
  name?: string
  fullHour?: number
  totalFullHour?: number
  batteryPower?: number
  batteryPowerStr?: string
  batteryCapacitySoc?: number
  gridPurchasedTodayEnergy?: number
  gridPurchasedTodayEnergyStr?: string
  gridSellTodayEnergy?: number
  gridSellTodayEnergyStr?: string
  stateExceptionFlag?: number
  etoday1?: number
  etotal1?: number
}

export interface InverterDetail {
  id: string
  sn: string
  stationId: number
  stationName: string
  collectorId: number
  collectorsn: string
  state: number
  eToday: number
  eTodayStr: string
  eMonth: number
  eMonthStr: string
  eYear: number
  eYearStr: string
  eTotal: number
  eTotalStr: string
  pac: number
  pacStr: string
  power: number
  powerStr: string
  fullHour: number
  fac: number
  facStr: string
  uAc1: number
  uAc2: number
  uAc3: number
  iAc1: number
  iAc2: number
  iAc3: number
  uPv1: number
  uPv2: number
  uPv3: number
  uPv4: number
  iPv1: number
  iPv2: number
  iPv3: number
  iPv4: number
  pow1: number
  pow2: number
  pow3: number
  pow4: number
  inverterTemperature: number
  dataTimestamp: string
  batteryPower: number
  batteryPowerStr: string
  batteryCapacitySoc: number
  batteryHealthSoh: number
  batteryTodayChargeEnergy: number
  batteryTodayChargeEnergyStr: string
  batteryTodayDischargeEnergy: number
  batteryTodayDischargeEnergyStr: string
  batteryTotalChargeEnergy: number
  batteryTotalChargeEnergyStr: string
  batteryTotalDischargeEnergy: number
  batteryTotalDischargeEnergyStr: string
  gridPurchasedTodayEnergy: number
  gridPurchasedTodayEnergyStr: string
  gridPurchasedTotalEnergy: number
  gridPurchasedTotalEnergyStr: string
  gridSellTodayEnergy: number
  gridSellTodayEnergyStr: string
  gridSellTotalEnergy: number
  gridSellTotalEnergyStr: string
  familyLoadPower: number
  familyLoadPowerStr: string
  homeLoadTodayEnergy: number
  homeLoadTodayEnergyStr: string
  homeLoadMonthEnergy: number
  homeLoadMonthEnergyStr: string
  homeLoadYearEnergy: number
  homeLoadYearEnergyStr: string
  homeLoadTotalEnergy: number
  homeLoadTotalEnergyStr: string
  homeLoadYesterdayEnergy: number
  homeLoadYesterdayEnergyStr: string
  familyLoadPercent: number
  totalLoadPower: number
  totalLoadPowerStr: string
  bypassLoadPower: number
  bypassLoadPowerStr: string
  backupTodayEnergy: number
  backupTodayEnergyStr: string
  backupTotalEnergy: number
  backupTotalEnergyStr: string
  homeGridTodayEnergy: number
  homeGridTodayEnergyStr: string
  homeGridMonthEnergy: number
  homeGridMonthEnergyStr: string
  homeGridYearEnergy: number
  homeGridYearEnergyStr: string
  homeGridTotalEnergy: number
  homeGridTotalEnergyStr: string
  gridPurchasedMonthEnergy: number
  gridPurchasedMonthEnergyStr: string
  gridPurchasedYearEnergy: number
  gridPurchasedYearEnergyStr: string
  gridSellMonthEnergy: number
  gridSellMonthEnergyStr: string
  gridSellYearEnergy: number
  gridSellYearEnergyStr: string
  batteryMonthChargeEnergy: number
  batteryMonthChargeEnergyStr: string
  batteryYearChargeEnergy: number
  batteryYearChargeEnergyStr: string
  batteryMonthDischargeEnergy: number
  batteryMonthDischargeEnergyStr: string
  batteryYearDischargeEnergy: number
  batteryYearDischargeEnergyStr: string
  pSum: number
  pSumStr: string
  psumCal: number
  psumCalStr: string
  reactivePower: number
  reactivePowerStr: string
  apparentPower: number
  apparentPowerStr: string
  dcPac: number
  dcPacStr: string
  generatorPower: number
  generatorPowerStr: string
  generatorTodayEnergy: number
  generatorTodayEnergyStr: string
  generatorTotalEnergy: number
  generatorTotalEnergyStr: string
  model: string
  type: number
  name: string
  acOutputType: number
  dcInputType: number
  version: string
  [key: string]: unknown
}

export interface InverterDayEntry {
  dataTimestamp: string
  timeStr: string
  pac: number
  pacStr: string
  pacPec?: string
  eToday: number
  eTotal: number
  state: number
  batteryPower?: number
  batteryPowerStr?: string
  batteryPowerPec?: string
  batteryCapacitySoc?: number
  pSum?: number
  pSumStr?: string
  pSumPec?: string
  psumCalPec?: string
  familyLoadPower?: number
  familyLoadPowerStr?: string
  familyLoadPowerPec?: string
  gridPurchasedTodayEnergy?: number
  gridSellTodayEnergy?: number
  bypassLoadPower?: number
  [key: string]: unknown
}

export interface InverterMonthEntry {
  inverterId: string
  energy: number
  energyStr: string
  date: number
  dateStr: string
  money: number
  moneyStr: string
  batteryDischargeEnergy: number
  batteryChargeEnergy: number
  gridPurchasedEnergy: number
  gridSellEnergy: number
  homeLoadEnergy: number
  fullHour?: number
}

export interface InverterYearEntry {
  inverterId: string
  energy: number
  energyStr: string
  date: number
  dateStr: string
  money: number
  moneyStr: string
  batteryDischargeEnergy: number
  batteryChargeEnergy: number
  gridPurchasedEnergy: number
  gridSellEnergy: number
  homeLoadEnergy: number
}

export interface AlarmRecord {
  id: string
  stationId: string
  stationName?: string
  alarmDeviceSn: string
  alarmCode: string
  alarmLevel: string
  alarmBeginTime: number
  alarmEndTime: number
  alarmMsg: string
  advice: string
  state: string
}

export interface AlarmListData {
  records: AlarmRecord[]
  total: number
  size: number
  current: number
  pages: number
}

export interface StationRecord {
  id: string
  stationName: string
  addr: string
  capacity: number
  capacityStr: string
  power: number
  powerStr: string
  dayEnergy: number
  dayEnergyStr: string
  monthEnergy: number
  monthEnergyStr: string
  yearEnergy: number
  yearEnergyStr: string
  allEnergy: number
  allEnergyStr: string
  state: number
  batteryTodayChargeEnergy?: number
  batteryTodayDischargeEnergy?: number
  gridPurchasedTodayEnergy?: number
  gridSellTodayEnergy?: number
  homeLoadTodayEnergy?: number
  [key: string]: unknown
}

export interface StationListData {
  stationStatusVo: {
    all: number
    normal: number
    fault: number
    offline: number
    building: number
  }
  page: {
    records: StationRecord[]
    total: number
    size: number
    current: number
    pages: number
  }
}

// Hooks

export function useInverterList(pageNo = 1, pageSize = 100) {
  return useSolisApi<InverterListData>("/v1/api/inverterList", {
    pageNo: String(pageNo),
    pageSize: String(pageSize),
  })
}

export function useInverterDetail(id?: string, sn?: string) {
  return useSolisApi<InverterDetail>(
    id || sn ? "/v1/api/inverterDetail" : null,
    { id: id || "", sn: sn || "" }
  )
}

export function useInverterDay(
  id: string,
  sn: string,
  time: string,
  timeZone: string
) {
  return useSolisApi<InverterDayEntry[]>(
    id ? "/v1/api/inverterDay" : null,
    { id, sn, money: "", time, timeZone }
  )
}

export function useInverterMonth(
  id: string,
  sn: string,
  month: string
) {
  return useSolisApi<InverterMonthEntry[]>(
    id ? "/v1/api/inverterMonth" : null,
    { id, sn, money: "", month }
  )
}

export function useInverterYear(
  id: string,
  sn: string,
  year: string
) {
  return useSolisApi<InverterYearEntry[]>(
    id ? "/v1/api/inverterYear" : null,
    { id, sn, money: "", year }
  )
}

export function useStationList(pageNo = 1, pageSize = 100) {
  return useSolisApi<StationListData>("/v1/api/userStationList", {
    pageNo,
    pageSize,
  })
}

export function useAlarmList(
  pageNo = 1,
  pageSize = 20,
  filters: Record<string, unknown> = {}
) {
  return useSolisApi<AlarmListData>("/v1/api/alarmList", {
    pageNo: String(pageNo),
    pageSize,
    ...filters,
  })
}
