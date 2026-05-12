import { append, el } from '../utils/dom.ts'

export function mountMarketingPage(mountEl: HTMLElement): void {
  mountEl.replaceChildren()
  const wrap = el('div', 'mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6')

  const intro = el('section', 'space-y-4')
  const h1 = el('h1', 'text-3xl font-bold tracking-tight text-white sm:text-4xl')
  h1.textContent = 'MapLLMUse'
  const lead = el('p', 'text-lg text-slate-400')
  lead.textContent =
    'Research project characterizing AI and human risk when coding — combining heuristic scans, CWE-style keywords, and optional AI summaries.'
  append(intro, h1, lead)

  const overview = el('section', 'space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-6')
  const h2a = el('h2', 'text-xl font-semibold text-white')
  h2a.textContent = 'Overview'
  const pa = el('p', 'text-slate-400 leading-relaxed')
  pa.textContent =
    'The scanner downloads a public GitHub archive, matches dangerous API patterns and reference tokens, aggregates scores, and can call Gemini for a short executive summary when configured.'
  append(overview, h2a, pa)

  const method = el('section', 'space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-6')
  const h2b = el('h2', 'text-xl font-semibold text-white')
  h2b.textContent = 'Method'
  const pb = el('p', 'text-slate-400 leading-relaxed')
  pb.textContent =
    'Heuristic substring and regex analysis — not a full SAST product. Results may include false positives; use findings as triage signals alongside code review.'
  append(method, h2b, pb)

  const res = el('section', 'space-y-4')
  const h2c = el('h2', 'text-xl font-semibold text-white')
  h2c.textContent = 'Resources'
  const grid = el('div', 'flex flex-col gap-3 sm:flex-row sm:flex-wrap')
  const mk = (label: string, href: string) => {
    const a = el(
      'a',
      'inline-flex rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-indigo-300 transition hover:border-indigo-500/50 hover:text-white',
      { href, target: '_blank', rel: 'noreferrer' },
    )
    a.textContent = label
    return a
  }
  append(grid, mk('GitHub', 'https://github.com/Mredozubov/MapLLMUse'))
  append(grid, mk('Video', 'https://www.youtube.com/watch?v=fO07jD9j4wI'))
  append(
    grid,
    mk('Release notes', 'https://docs.google.com/document/d/1u-RiW2BLiMWl29UT704ccU3txAmQd_xoVWAsQ6mRvLc/edit?usp=sharing'),
  )
  append(res, h2c, grid)

  const back = el('p', 'pt-4')
  const a = el('a', 'text-sm font-medium text-indigo-400 hover:text-indigo-300', { href: '#/' })
  a.textContent = '← Back to scanner'
  append(back, a)

  append(wrap, intro, overview, method, res, back)
  append(mountEl, wrap)
}
