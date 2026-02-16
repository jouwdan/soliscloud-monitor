import crypto from "crypto"

const SOLIS_API_URL = "https://www.soliscloud.com:13333"

function getContentMD5(body: string): string {
  const hash = crypto.createHash("md5").update(body).digest()
  return hash.toString("base64")
}

function getGMTDate(): string {
  const now = new Date()
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const dayName = days[now.getUTCDay()]
  const day = now.getUTCDate()
  const month = months[now.getUTCMonth()]
  const year = now.getUTCFullYear()
  const hours = String(now.getUTCHours()).padStart(2, "0")
  const minutes = String(now.getUTCMinutes()).padStart(2, "0")
  const seconds = String(now.getUTCSeconds()).padStart(2, "0")
  return `${dayName}, ${day} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`
}

function getAuthorization(
  apiId: string,
  apiSecret: string,
  contentMD5: string,
  contentType: string,
  date: string,
  canonicalizedResource: string
): string {
  const signStr = `POST\n${contentMD5}\n${contentType}\n${date}\n${canonicalizedResource}`
  const hmac = crypto.createHmac("sha1", apiSecret)
  hmac.update(signStr)
  const sign = hmac.digest("base64")
  return `API ${apiId}:${sign}`
}

export async function solisApiCall<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  credentials?: { apiId: string; apiSecret: string }
): Promise<T> {
  const apiId = credentials?.apiId || process.env.SOLIS_API_ID
  const apiSecret = credentials?.apiSecret || process.env.SOLIS_API_SECRET

  if (!apiId || !apiSecret) {
    throw new Error("SOLIS_API_ID and SOLIS_API_SECRET must be set")
  }

  const bodyStr = JSON.stringify(body)
  const contentType = "application/json;charset=UTF-8"
  const contentMD5 = getContentMD5(bodyStr)
  const date = getGMTDate()
  const canonicalizedResource = endpoint
  const authorization = getAuthorization(
    apiId,
    apiSecret,
    contentMD5,
    contentType,
    date,
    canonicalizedResource
  )

  const response = await fetch(`${SOLIS_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-MD5": contentMD5,
      "Content-Type": contentType,
      Date: date,
      Authorization: authorization,
    },
    body: bodyStr,
  })

  if (!response.ok) {
    throw new Error(`Solis API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.success && data.code !== "0") {
    throw new Error(`Solis API error: ${data.code} - ${data.msg}`)
  }

  return data.data as T
}
