import type { ScanVulnerabilityRow } from '../types/scan.ts'
import { append, el } from '../utils/dom.ts'

function riskTone(level: string): string {
  const l = level.toLowerCase()
  if (l === 'high') return 'text-rose-300 bg-rose-500/15 border-rose-500/30'
  if (l === 'medium') return 'text-amber-300 bg-amber-500/15 border-amber-500/30'
  return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
}

export function createThreatTable(): {
  root: HTMLElement
  setRows: (rows: ScanVulnerabilityRow[], targetLabel: string) => void
  clear: () => void
} {
  const root = el('div', 'hidden rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden')
  const head = el('div', 'border-b border-slate-800 px-4 py-3 sm:px-6')
  const title = el('h2', 'text-lg font-semibold text-white')
  title.textContent = 'Pattern matches'
  const targetLine = el('p', 'mt-1 text-sm text-slate-400 break-all')
  append(head, title, targetLine)

  const wrap = el('div', 'overflow-x-auto')
  const table = el('table', 'w-full min-w-[520px] text-left text-sm')
  const thead = el('thead', 'bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500')
  const thr = el('tr', '')
  for (const [label, cls] of [
    ['Finding', 'px-4 py-3 sm:px-6'],
    ['Score', 'px-4 py-3 text-right font-mono tabular-nums'],
    ['Severity', 'px-4 py-3'],
  ]) {
    const th = el('th', cls)
    th.textContent = label
    append(thr, th)
  }
  append(thead, thr)
  const tbody = el('tbody', 'divide-y divide-slate-800/80')
  append(table, thead, tbody)
  append(wrap, table)
  append(root, head, wrap)

  return {
    root,
    setRows(rows, targetLabel) {
      targetLine.textContent = `Target: ${targetLabel}`
      tbody.replaceChildren()
      for (const row of rows) {
        const tr = el('tr', 'hover:bg-slate-800/40')
        const td1 = el('td', 'px-4 py-3 font-medium text-slate-100 sm:px-6')
        td1.textContent = row.name
        const td2 = el('td', 'px-4 py-3 text-right font-mono text-slate-300 tabular-nums')
        td2.textContent = String(row.score)
        const td3 = el('td', 'px-4 py-3 sm:px-6')
        const pill = el(
          'span',
          `inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${riskTone(row.riskLevel)}`,
        )
        pill.textContent = row.riskLevel || 'Low'
        append(td3, pill)
        append(tr, td1, td2, td3)
        append(tbody, tr)
      }
      if (rows.length === 0) {
        const tr = el('tr', '')
        const td = el('td', 'px-4 py-8 text-center text-slate-500 sm:px-6', { colspan: '3' })
        td.textContent = 'No pattern rows in this scan.'
        append(tr, td)
        append(tbody, tr)
      }
      root.className =
        'max-lg:hidden rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden lg:block'
    },
    clear() {
      root.className = 'hidden rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden'
      tbody.replaceChildren()
    },
  }
}
