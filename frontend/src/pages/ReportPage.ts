import { createSummaryPanel } from '../components/SummaryPanel.ts'
import { createThreatCards } from '../components/ThreatCards.ts'
import { countSeverities, createThreatChart, topByScore } from '../components/ThreatChart.ts'
import { createThreatTable } from '../components/ThreatTable.ts'
import { loadLastScan } from '../utils/lastScanStorage.ts'
import { append, el } from '../utils/dom.ts'

export function mountReportPage(mountEl: HTMLElement): void {
  mountEl.replaceChildren()
  const wrap = el('div', 'mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6')

  const data = loadLastScan()

  if (data) {
    const title = el('h1', 'text-xl font-semibold text-white')
    title.textContent = 'Latest scan report'
    const sub = el('p', 'break-all text-sm text-slate-400')
    sub.textContent = data.target

    const chart = createThreatChart()
    chart.update(countSeverities(data.vulnerabilities), topByScore(data.vulnerabilities))

    const table = createThreatTable()
    table.setRows(data.vulnerabilities, data.target)

    const cards = createThreatCards()
    cards.setRows(data.vulnerabilities)

    const summary = createSummaryPanel()
    summary.setSummary(data.aiSummary || '')

    const stat = el('p', 'text-xs text-slate-500')
    stat.textContent =
      'This view uses the most recent successful scan in this browser (session storage). Run a new scan from the Scanner page to update.'

    const grid = el('div', 'grid gap-6 lg:grid-cols-3')
    const left = el('div', 'space-y-6 lg:col-span-2')
    const right = el('div', 'space-y-6')
    append(left, table.root, cards.root)
    append(right, chart.root)
    append(grid, left, right)

    const results = el('div', 'space-y-6')
    append(results, grid, summary.root)

    append(wrap, title, sub, results, stat)
  } else {
    const title = el('h1', 'text-xl font-semibold text-white')
    title.textContent = 'Report'
    const p = el('p', 'max-w-xl text-slate-300')
    p.textContent =
      'No scan is stored for this browser session yet. Open the Scanner page, run a repository scan, then return here to see the same AI summary and findings table.'
    const go = el('a', 'mt-4 inline-block font-medium text-indigo-400 hover:text-indigo-300', { href: '#/' })
    go.textContent = 'Go to Scanner'
    append(wrap, title, p, go)
  }

  const foot = el('div', 'mt-8 space-y-2 border-t border-slate-800/80 pt-6')
  const staticNote = el('p', 'text-sm text-slate-500')
  staticNote.textContent =
    'Optional: the repository still ships a static sample HTML report (Bootstrap) for reference.'
  const staticLink = el('a', 'text-sm font-medium text-indigo-400 hover:text-indigo-300', {
    href: '/Data/index.html',
    target: '_blank',
    rel: 'noreferrer',
  })
  staticLink.textContent = 'Open static sample report in new tab'

  const back = el('p', '')
  const backA = el('a', 'text-sm font-medium text-indigo-400 hover:text-indigo-300', { href: '#/' })
  backA.textContent = 'Back to scanner'
  append(back, backA)
  append(foot, staticNote, staticLink, back)
  append(wrap, foot)
  append(mountEl, wrap)
}
