import { NextRequest, NextResponse } from "next/server"
import { solisApiCall } from "@/lib/solis-api"

function credentialsConfigured(): boolean {
  return Boolean(process.env.SOLIS_API_ID && process.env.SOLIS_API_SECRET)
}

/** GET /api/solis  — lightweight health / config check */
export async function GET() {
  if (!credentialsConfigured()) {
    return NextResponse.json(
      { configured: false, error: "NOT_CONFIGURED" },
      { status: 200 }
    )
  }
  return NextResponse.json({ configured: true })
}

/** POST /api/solis  — proxy any SolisCloud API call */
export async function POST(request: NextRequest) {
  if (!credentialsConfigured()) {
    return NextResponse.json(
      {
        error: "NOT_CONFIGURED",
        message:
          "SOLIS_API_ID and SOLIS_API_SECRET environment variables are not set. Add them in the Vars section of the sidebar.",
      },
      { status: 503 }
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

    const data = await solisApiCall(endpoint, body || {})
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Solis API Proxy]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
