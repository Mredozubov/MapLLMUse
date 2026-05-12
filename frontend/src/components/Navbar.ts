import { append, el } from '../utils/dom.ts'

const linkBase =
  'rounded-lg px-3 py-2 text-slate-300 transition hover:bg-slate-800/80 hover:text-white'

export function createNavbar(): HTMLElement {
  const nav = el('nav', 'sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md')
  const inner = el('div', 'mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6')
  const brand = el('div', 'flex min-w-0 items-center gap-3')
  const logo = el(
    'a',
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white',
    { href: '#/', 'aria-label': 'Home' },
  )
  logo.textContent = 'M'
  const titles = el('div', 'flex min-w-0 flex-col')
  const h = el('span', 'truncate text-sm font-semibold tracking-tight text-white sm:text-base')
  h.textContent = 'MapLLMUse'
  const sub = el('span', 'hidden text-xs text-slate-400 sm:block')
  sub.textContent = 'Security pattern scanner'
  append(titles, h, sub)
  append(brand, logo, titles)

  const links = el('div', 'flex flex-wrap items-center gap-1 text-sm sm:gap-2')
  const aScan = el('a', linkBase, { href: '#/' })
  aScan.textContent = 'Scanner'
  const aAbout = el('a', linkBase, { href: '#/marketing' })
  aAbout.textContent = 'Project'
  const aReport = el('a', linkBase, { href: '#/report' })
  aReport.textContent = 'Report'
  const aGh = el(
    'a',
    linkBase + ' hidden sm:inline-flex',
    { href: 'https://github.com/Mredozubov/MapLLMUse', target: '_blank', rel: 'noreferrer' },
  )
  aGh.textContent = 'GitHub'
  append(links, aScan, aAbout, aReport, aGh)
  append(inner, brand, links)
  append(nav, inner)
  return nav
}
