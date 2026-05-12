import { append, el } from '../utils/dom.ts'

export function createSummaryPanel(): {
  root: HTMLElement
  setSummary: (text: string) => void
  clear: () => void
} {
  const root = el(
    'div',
    'hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-indigo-950/30 p-4 sm:p-6',
  )
  const h = el('h2', 'flex items-center gap-2 text-lg font-semibold text-white')
  const icon = el('span', 'text-xl', { 'aria-hidden': 'true' })
  icon.textContent = '🤖'
  const t = el('span', '')
  t.textContent = 'AI executive summary'
  append(h, icon, t)

  const body = el(
    'div',
    'mt-4 whitespace-pre-wrap rounded-xl border border-indigo-500/20 bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-200',
  )
  append(root, h, body)

  return {
    root,
    setSummary(text) {
      body.textContent = text
      root.classList.remove('hidden')
    },
    clear() {
      root.classList.add('hidden')
      body.textContent = ''
    },
  }
}
