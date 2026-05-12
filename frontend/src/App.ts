import { createNavbar } from './components/Navbar.ts'
import { mountHomePage } from './pages/HomePage.ts'
import { mountMarketingPage } from './pages/MarketingPage.ts'
import { mountReportPage } from './pages/ReportPage.ts'
import { append, el } from './utils/dom.ts'

function parseRoute(): 'home' | 'marketing' | 'report' {
  const raw = (location.hash || '#/').replace(/^#/, '')
  const seg = (raw.startsWith('/') ? raw.slice(1) : raw).split('/')[0] || ''
  if (seg === 'marketing') return 'marketing'
  if (seg === 'report') return 'report'
  return 'home'
}

export function mountApp(root: HTMLElement): void {
  root.replaceChildren()
  const navbar = createNavbar()
  const outlet = el('div', 'min-h-[50vh]')
  append(root, navbar, outlet)

  const render = () => {
    outlet.replaceChildren()
    const r = parseRoute()
    if (r === 'marketing') mountMarketingPage(outlet)
    else if (r === 'report') mountReportPage(outlet)
    else mountHomePage(outlet)
  }

  window.addEventListener('hashchange', render)
  if (!location.hash || location.hash === '#') {
    location.hash = '#/'
  }
  render()
}
