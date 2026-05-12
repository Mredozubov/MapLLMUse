import { append, el } from '../utils/dom.ts'

export function createLoadingState(): {
  root: HTMLElement
  show: (message?: string) => void
  hide: () => void
} {
  const root = el(
    'div',
    'hidden items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm text-indigo-200',
  )
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')

  const spinner = el(
    'div',
    'h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400',
  )
  const text = el('span', 'text-indigo-100/90')
  text.textContent = 'Scanning repository...'
  append(root, spinner, text)

  let progress = 0
  let timer: ReturnType<typeof setInterval> | null = null

  return {
    root,
    show(message) {
      root.classList.remove('hidden')
      root.classList.add('flex')
      text.textContent = message ?? 'Scanning repository... this can take a few minutes.'
      progress = 5
      if (timer) clearInterval(timer)
      timer = setInterval(() => {
        progress = Math.min(92, progress + Math.random() * 8)
        text.textContent = `${message ?? 'Scanning'} (${Math.round(progress)}%)`
      }, 2200)
    },
    hide() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      root.classList.add('hidden')
      root.classList.remove('flex')
    },
  }
}
