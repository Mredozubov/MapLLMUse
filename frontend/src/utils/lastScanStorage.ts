import type { ScanSuccessResponse } from '../types/scan.ts'

const KEY = 'mapllmuse_last_scan_v1'

export function saveLastScan(result: ScanSuccessResponse): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(result))
  } catch {
    /* quota / private mode */
  }
}

export function loadLastScan(): ScanSuccessResponse | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as unknown
    if (
      typeof o === 'object' &&
      o !== null &&
      (o as { ok?: unknown }).ok === true &&
      typeof (o as { aiSummary?: unknown }).aiSummary === 'string' &&
      Array.isArray((o as { vulnerabilities?: unknown }).vulnerabilities)
    ) {
      return o as ScanSuccessResponse
    }
    return null
  } catch {
    return null
  }
}
