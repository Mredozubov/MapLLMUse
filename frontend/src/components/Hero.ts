import { append, el } from '../utils/dom.ts'

export function createHero(): HTMLElement {
  const section = el('section', 'border-b border-slate-800/60 bg-slate-900/40 py-10 sm:py-14')
  const wrap = el('div', 'mx-auto max-w-7xl px-4 sm:px-6')
  const badge = el(
    'span',
    'mb-4 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-300',
  )
  badge.textContent = 'Research · CWE-style heuristics'
  const h1 = el(
    'h1',
    'max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl',
  )
  h1.textContent = 'Repository security pattern dashboard'
  const p = el('p', 'mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg')
  p.textContent =
    'Scan a GitHub repository for risky API patterns and CWE-aligned keywords. Results include ranked findings and an optional AI executive summary.'
  append(wrap, badge, h1, p)
  append(section, wrap)
  return section
}
