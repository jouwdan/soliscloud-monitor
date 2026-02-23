import { NextRequest, NextResponse } from "next/server"
import { solisApiCall } from "@/lib/solis-api"
import { SolisRequestSchema } from "@/lib/solis-api-schema"

/**
 * Resolve credentials: request headers first, then env vars.
 * Returns null when neither source provides both values.
 */
function resolveCredentials(headers: Headers) {
  const apiId =
    headers.get("x-solis-api-id") || process.env.SOLIS_API_ID || ""
  const apiSecret =
    headers.get("x-solis-api-secret") || process.env.SOLIS_API_SECRET || ""

  if (apiId && apiSecret) return { apiId, apiSecret }
  return null
}

/** POST /api/solis  — proxy any SolisCloud API call */
export async function POST(request: NextRequest) {
  const creds = resolveCredentials(request.headers)

  if (!creds) {
    return NextResponse.json(
      {
        error: "NO_CREDENTIALS",
        message:
          "No API credentials found. Enter your Solis API ID and Secret to continue.",
      },
      { status: 401 }
    )
  }

  try {
    const json = await request.json()
    const result = SolisRequestSchema.safeParse(json)

    if (!result.success) {
      console.error("[Solis API Proxy] Validation Failed:", JSON.stringify(result.error.format()))
      return NextResponse.json(
        {
          error: "Invalid request parameters",
          details: result.error.format(),
        },
        { status: 400 }
      )
    }

    const { endpoint, body } = result.data

    // solisApiCall expects body as Record<string, unknown>, which our schema satisfies (mostly)
    // We cast to any or Record<string, unknown> if TS complains, but it should be fine as it's structurally compatible.
    const data = await solisApiCall(endpoint, body as Record<string, unknown>, creds)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Solis API Proxy]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
