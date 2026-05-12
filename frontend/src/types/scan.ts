/** Row returned in JSON mode from the Netlify scan function (Node `scan-core` or `script.py` when proxied). */
export interface ScanVulnerabilityRow {
  name: string
  score: number
  riskLevel: string
}

/** Successful scan payload (`script.py` `--json` success path). */
export interface ScanSuccessResponse {
  ok: true
  target: string
  vulnerabilities: ScanVulnerabilityRow[]
  aiSummary: string
}

/** Error payload from `script.py` `--json` or the function wrapper. */
export interface ScanErrorResponse {
  ok: false
  error: string
  detail?: string
  stderr?: string
  exitCode?: number
}

export type ScanJsonBody = ScanSuccessResponse | ScanErrorResponse

/** Outcome of POST `/.netlify/functions/scan`. */
export interface ScanPostResult {
  httpStatus: number
  fetchOk: boolean
  body: unknown
}
