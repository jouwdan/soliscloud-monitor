import { z } from "zod"

/**
 * Valid SolisCloud API endpoints used by this application.
 */
export const SolisEndpoint = {
  INVERTER_LIST: "/v1/api/inverterList",
  INVERTER_DETAIL: "/v1/api/inverterDetail",
  INVERTER_DAY: "/v1/api/inverterDay",
  INVERTER_MONTH: "/v1/api/inverterMonth",
  INVERTER_YEAR: "/v1/api/inverterYear",
  USER_STATION_LIST: "/v1/api/userStationList",
  ALARM_LIST: "/v1/api/alarmList",
} as const

// Helper for pagination (pageNo/pageSize can be string or number)
const PaginationSchema = z.object({
  pageNo: z.union([z.string(), z.number()]),
  pageSize: z.union([z.string(), z.number()]),
})

const InverterListSchema = PaginationSchema

const InverterDetailSchema = z.object({
  id: z.string().optional(),
  sn: z.string().optional(),
})

const InverterDaySchema = z.object({
  id: z.string(),
  sn: z.string(),
  money: z.string().optional(),
  time: z.string(),
  timeZone: z.string(),
})

const InverterMonthSchema = z.object({
  id: z.string(),
  sn: z.string(),
  money: z.string().optional(),
  month: z.string(),
})

const InverterYearSchema = z.object({
  id: z.string(),
  sn: z.string(),
  money: z.string().optional(),
  year: z.string(),
})

const UserStationListSchema = PaginationSchema

// AlarmList can accept extra filters, but current usage is just pagination.
// We strip unknown keys by default, so if filters are added later, this schema needs update.
const AlarmListSchema = PaginationSchema

export const SolisRequestSchema = z.discriminatedUnion("endpoint", [
  z.object({
    endpoint: z.literal(SolisEndpoint.INVERTER_LIST),
    body: InverterListSchema,
  }),
  z.object({
    endpoint: z.literal(SolisEndpoint.INVERTER_DETAIL),
    body: InverterDetailSchema,
  }),
  z.object({
    endpoint: z.literal(SolisEndpoint.INVERTER_DAY),
    body: InverterDaySchema,
  }),
  z.object({
    endpoint: z.literal(SolisEndpoint.INVERTER_MONTH),
    body: InverterMonthSchema,
  }),
  z.object({
    endpoint: z.literal(SolisEndpoint.INVERTER_YEAR),
    body: InverterYearSchema,
  }),
  z.object({
    endpoint: z.literal(SolisEndpoint.USER_STATION_LIST),
    body: UserStationListSchema,
  }),
  z.object({
    endpoint: z.literal(SolisEndpoint.ALARM_LIST),
    body: AlarmListSchema,
  }),
])

export type SolisRequest = z.infer<typeof SolisRequestSchema>
