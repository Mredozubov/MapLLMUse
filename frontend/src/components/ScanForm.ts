import { append, el } from '../utils/dom.ts'

export type ScanFormHandlers = {
  onSubmit: (target: string) => void
}

export function createScanForm(handlers: ScanFormHandlers): {
  root: HTMLElement
  setDisabled: (disabled: boolean) => void
  getValue: () => string
} {
  const root = el('div', 'rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl shadow-black/20 sm:p-6')
  const form = el('form', 'flex flex-col gap-3 sm:flex-row sm:items-end')
  form.setAttribute('autocomplete', 'off')

  const field = el('div', 'min-w-0 flex-1')
  const label = el('label', 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400', {
    for: 'scan-target',
  })
  label.textContent = 'Repository URL'
  const input = el('input', 'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-indigo-500/0 transition focus:border-indigo-500/50 focus:ring-4', {
    type: 'text',
    id: 'scan-target',
    name: 'target',
    placeholder: 'https://github.com/owner/repo',
    inputmode: 'url',
    'aria-label': 'Repository or website URL',
  })
  append(field, label, input)

  const btnWrap = el('div', 'shrink-0')
  const btn = el(
    'button',
    'w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto',
    { type: 'submit' },
  )
  btn.textContent = 'Run scan'
  append(btnWrap, btn)

  append(form, field, btnWrap)
  append(root, form)

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    handlers.onSubmit(input.value.trim())
  })

  return {
    root,
    setDisabled(disabled) {
      btn.disabled = disabled
      input.disabled = disabled
    },
    getValue: () => input.value.trim(),
  }
}
