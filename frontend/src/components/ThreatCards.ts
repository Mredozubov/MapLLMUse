import type { ScanVulnerabilityRow } from '../types/scan.ts'
import { append, el } from '../utils/dom.ts'

function cardBorder(level: string): string {
  const l = level.toLowerCase()
  if (l === 'high') return 'border-rose-500/35 bg-rose-500/5'
  if (l === 'medium') return 'border-amber-500/35 bg-amber-500/5'
  return 'border-emerald-500/35 bg-emerald-500/5'
}

export function createThreatCards(): {
  root: HTMLElement
  setRows: (rows: ScanVulnerabilityRow[]) => void
  clear: () => void
} {
  const root = el('div', 'hidden grid gap-3 sm:grid-cols-2 lg:hidden')

  return {
    root,
    setRows(rows) {
      root.replaceChildren()
      for (const row of rows) {
        const card = el('div', `rounded-xl border p-4 ${cardBorder(row.riskLevel)}`)
        const top = el('div', 'flex items-start justify-between gap-2')
        const name = el('h3', 'font-semibold text-white')
        name.textContent = row.name
        const pill = el(
          'span',
          'shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-semibold text-slate-200',
        )
        pill.textContent = row.riskLevel || 'Low'
        append(top, name, pill)
        const score = el('p', 'mt-2 font-mono text-2xl font-bold tabular-nums text-indigo-300')
        score.textContent = String(row.score)
        append(card, top, score)
        append(root, card)
      }
      if (rows.length === 0) {
        const empty = el(
          'div',
          'rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-500',
        )
        empty.textContent = 'No findings for this scan.'
        append(root, empty)
      }
      root.classList.remove('hidden')
    },
    clear() {
      root.classList.add('hidden')
      root.replaceChildren()
    },
  }
}
