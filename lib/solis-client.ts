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
      refreshInterval: options.refreshInterval ?? 300000,
      revalidateOnFocus: options.revalidateOnFocus ?? false,
      dedupingInterval: 10000,
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
  homeLoadTotalEnergy: number
  homeLoadTotalEnergyStr: string
  pSum: number
  pSumStr: string
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
  eToday: number
  eTotal: number
  state: number
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
