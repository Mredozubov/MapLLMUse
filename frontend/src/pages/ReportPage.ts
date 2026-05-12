import { append, el } from '../utils/dom.ts'

/** Embedded saved HTML report (served as static `/Data/index.html` after build or sync). */
export function mountReportPage(mountEl: HTMLElement): void {
  mountEl.replaceChildren()
  const wrap = el('div', 'mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6')
  const note = el('p', 'text-sm text-slate-400')
  note.textContent =
    'Latest generated report from the scanner pipeline (static). Open in a new tab if the frame is blocked by your browser.'
  const frameWrap = el(
    'div',
    'min-h-[70vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-inner',
  )
  const iframe = el('iframe', 'h-[70vh] w-full border-0 bg-white', {
    title: 'Saved security report',
    src: '/Data/index.html',
    loading: 'lazy',
  })
  append(frameWrap, iframe)

  const back = el('p', '')
  const a = el('a', 'text-sm font-medium text-indigo-400 hover:text-indigo-300', { href: '#/' })
  a.textContent = '← Back to scanner'
  append(back, a)

  append(wrap, note, frameWrap, back)
  append(mountEl, wrap)
}
