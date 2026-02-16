import crypto from "crypto"

const SOLIS_API_URL = "https://www.soliscloud.com:13333"

/**
 * MD5-hash the body string and return its Base64 encoding.
 * The Solis docs specify:
 *   1. MD5 hash the body
 *   2. Get the 128-bit binary digest
 *   3. Base64-encode it
 */
function getContentMD5(body: string): string {
  return crypto.createHash("md5").update(body, "utf8").digest("base64")
}

/**
 * Return the current UTC time in RFC-7231 format.
 * Example: "Mon, 17 Feb 2026 09:32:15 GMT"
 *
 * The Solis docs require: EEE, d MMM yyyy HH:mm:ss 'GMT'
 * Note: day-of-month must NOT be zero-padded (Java SimpleDateFormat "d").
 */
function getGMTDate(): string {
  return new Date().toUTCString()
}

/**
 * Build the Authorization header value.
 *
 * Sign = base64( HmacSHA1( apiSecret,
 *   "POST\n" + Content-MD5 + "\n" + Content-Type + "\n" + Date + "\n" + CanonicalizedResource ) )
 *
 * Authorization: "API " + apiId + ":" + Sign
 */
function getAuthorization(
  apiId: string,
  apiSecret: string,
  contentMD5: string,
  contentType: string,
  date: string,
  canonicalizedResource: string
): string {
  const signStr = `POST\n${contentMD5}\n${contentType}\n${date}\n${canonicalizedResource}`
  const sign = crypto
    .createHmac("sha1", apiSecret)
    .update(signStr)
    .digest("base64")
  return `API ${apiId}:${sign}`
}

export async function solisApiCall<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  credentials?: { apiId: string; apiSecret: string }
): Promise<T> {
  const apiId = credentials?.apiId || process.env.SOLIS_API_ID || ""
  const apiSecret = credentials?.apiSecret || process.env.SOLIS_API_SECRET || ""

  if (!apiId || !apiSecret) {
    throw new Error(
      "No API credentials. Please enter your Solis API ID and Secret."
    )
  }

  const bodyStr = JSON.stringify(body)
  const contentType = "application/json"
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

  console.log("[v0] Solis request ->", endpoint, "date:", date, "md5:", contentMD5)

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
    const text = await response.text().catch(() => "")
    console.error("[v0] Solis HTTP error", response.status, text)
    throw new Error(
      `Solis API error: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()

  if (!data.success && data.code !== "0") {
    throw new Error(`Solis API error: ${data.code} - ${data.msg}`)
  }

  return data.data as T
}
