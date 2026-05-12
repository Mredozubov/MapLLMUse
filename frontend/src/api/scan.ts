import type { ScanJsonBody, ScanPostResult } from '../types/scan.ts'

/** POST to Netlify scan function; Vite dev proxies `/.netlify/functions` when configured. */
export const SCAN_FUNCTION_PATH = '/.netlify/functions/scan'

function scanUrl(): string {
  const base = import.meta.env.VITE_SCAN_API_BASE
  if (base && base.length > 0) {
    return `${base.replace(/\/$/, '')}${SCAN_FUNCTION_PATH}`
  }
  return SCAN_FUNCTION_PATH
}

export function isScanErrorBody(value: unknown): value is ScanJsonBody & { ok: false } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  )
}

/**
 * POST `{ target }` to the Netlify scan function (unchanged API contract).
 * Reads `response.text()` first so non-JSON gateway pages become a structured `{ ok: false }` body.
 */
export async function postScan(target: string): Promise<ScanPostResult> {
  const res = await fetch(scanUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  })

  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = {
      ok: false,
      error: 'Response was not valid JSON',
      detail: text.trim().slice(0, 4000),
    }
  }

  return {
    httpStatus: res.status,
    fetchOk: res.ok,
    body,
  }
}
