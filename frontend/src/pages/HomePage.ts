import { postScan } from '../api/scan.ts'
import { isScanErrorBody } from '../api/scan.ts'
import type { ScanSuccessResponse } from '../types/scan.ts'
import { createErrorBanner } from '../components/ErrorBanner.ts'
import { createHero } from '../components/Hero.ts'
import { createLoadingState } from '../components/LoadingState.ts'
import { createScanForm } from '../components/ScanForm.ts'
import { createSummaryPanel } from '../components/SummaryPanel.ts'
import { countSeverities, createThreatChart, topByScore } from '../components/ThreatChart.ts'
import { createThreatCards } from '../components/ThreatCards.ts'
import { createThreatTable } from '../components/ThreatTable.ts'
import { saveLastScan } from '../utils/lastScanStorage.ts'
import { append, el } from '../utils/dom.ts'

function formatHttpError(body: unknown, httpStatus: number, fetchOk: boolean): string {
  if (isScanErrorBody(body)) {
    let s = body.error
    if (body.detail) s += `\n${body.detail}`
    if (body.stderr) s += `\n${body.stderr}`
    return s
  }
  return `Request failed (HTTP ${httpStatus}, ok=${fetchOk}).`
}

function isSuccessBody(b: unknown): b is ScanSuccessResponse {
  return (
    typeof b === 'object' &&
    b !== null &&
    'ok' in b &&
    (b as { ok: unknown }).ok === true &&
    'target' in b &&
    'vulnerabilities' in b &&
    'aiSummary' in b &&
    Array.isArray((b as ScanSuccessResponse).vulnerabilities)
  )
}

export function mountHomePage(mountEl: HTMLElement): void {
  mountEl.replaceChildren()

  const hero = createHero()
  const errorBanner = createErrorBanner()
  const loading = createLoadingState()
  const chart = createThreatChart()
  const table = createThreatTable()
  const cards = createThreatCards()
  const summary = createSummaryPanel()

  let scanForm: ReturnType<typeof createScanForm>

  async function runScan(target: string) {
    errorBanner.hide()
    chart.clear()
    table.clear()
    cards.clear()
    summary.clear()

    if (!target) {
      errorBanner.show('Please enter a repository or site URL.')
      return
    }

    scanForm.setDisabled(true)
    loading.show()

    try {
      const { httpStatus, fetchOk, body } = await postScan(target)
      loading.hide()

      if (!fetchOk || !isSuccessBody(body)) {
        errorBanner.show(formatHttpError(body, httpStatus, fetchOk))
        return
      }

      const data = body
      saveLastScan(data)
      const rows = data.vulnerabilities
      table.setRows(rows, data.target)
      cards.setRows(rows)
      summary.setSummary(data.aiSummary || '')
      chart.update(countSeverities(rows), topByScore(rows))
    } catch {
      loading.hide()
      errorBanner.show(
        'Network error. Run `netlify dev` from the repo root (with venv activated) or check the Vite proxy target.',
      )
    } finally {
      scanForm.setDisabled(false)
    }
  }

  scanForm = createScanForm({
    onSubmit: (target) => void runScan(target),
  })

  const main = el('main', 'mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10')
  const gridTop = el('div', 'grid gap-6 lg:grid-cols-3')
  const leftCol = el('div', 'space-y-6 lg:col-span-2')
  const rightCol = el('div', 'space-y-6')

  append(leftCol, scanForm.root, loading.root, errorBanner.root)
  append(rightCol, chart.root)
  append(gridTop, leftCol, rightCol)

  const results = el('div', 'mt-8 space-y-6')
  const split = el('div', 'grid gap-6 lg:grid-cols-1')
  append(split, table.root, cards.root)
  append(results, split, summary.root)

  append(main, gridTop, results)
  append(mountEl, hero, main)
}
