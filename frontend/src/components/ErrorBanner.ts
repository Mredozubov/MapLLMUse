import { append, el } from '../utils/dom.ts'

export function createErrorBanner(): {
  root: HTMLElement
  show: (message: string) => void
  hide: () => void
} {
  const root = el(
    'div',
    'hidden rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100',
  )
  root.setAttribute('role', 'alert')

  const row = el('div', 'flex items-start justify-between gap-3')
  const msg = el('pre', 'whitespace-pre-wrap break-words font-sans text-sm leading-relaxed')
  const close = el(
    'button',
    'shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/20',
    { type: 'button', 'aria-label': 'Dismiss' },
  )
  close.textContent = 'Dismiss'
  close.addEventListener('click', () => {
    root.classList.add('hidden')
    msg.textContent = ''
  })
  append(row, msg, close)
  append(root, row)

  return {
    root,
    show(message) {
      msg.textContent = message
      root.classList.remove('hidden')
    },
    hide() {
      root.classList.add('hidden')
      msg.textContent = ''
    },
  }
}
