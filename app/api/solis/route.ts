import { NextRequest, NextResponse } from "next/server"
import { solisApiCall } from "@/lib/solis-api"

/**
 * Resolve credentials: request headers first, then env vars.
 * Returns null when neither source provides both values.
 */
function resolveCredentials(headers: Headers) {
  const apiId =
    headers.get("x-solis-api-id") || process.env.SOLIS_API_ID || ""
  const apiSecret =
    headers.get("x-solis-api-secret") || process.env.SOLIS_API_SECRET || ""

  console.log("[v0] resolveCredentials: apiId length=", apiId.length, "apiSecret length=", apiSecret.length, "source=", headers.get("x-solis-api-id") ? "header" : process.env.SOLIS_API_ID ? "env" : "none")

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
    const { endpoint, body } = await request.json()

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid endpoint" },
        { status: 400 }
      )
    }

    const data = await solisApiCall(endpoint, body || {}, creds)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Solis API Proxy]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
