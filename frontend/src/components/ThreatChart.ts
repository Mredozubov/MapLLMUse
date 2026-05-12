import { Chart, registerables } from 'chart.js'
import type { ScanVulnerabilityRow } from '../types/scan.ts'
import { append, el } from '../utils/dom.ts'

Chart.register(...registerables)

export type SeverityCounts = { high: number; medium: number; low: number }

export function createThreatChart(): {
  root: HTMLElement
  update: (counts: SeverityCounts, topRows: ScanVulnerabilityRow[]) => void
  clear: () => void
} {
  const root = el(
    'div',
    'hidden space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6',
  )

  const h1 = el('h2', 'text-lg font-semibold text-white')
  h1.textContent = 'Severity distribution'
  const doughSlot = el('div', 'relative flex min-h-[200px] items-center justify-center')

  const h2 = el('h3', 'text-sm font-semibold uppercase tracking-wide text-slate-400')
  h2.textContent = 'Top findings by score'
  const barSlot = el('div', 'relative min-h-[160px]')

  append(root, h1, doughSlot, h2, barSlot)

  let doughChart: InstanceType<typeof Chart> | null = null
  let barChart: InstanceType<typeof Chart> | null = null

  function destroyAll() {
    if (doughChart) {
      doughChart.destroy()
      doughChart = null
    }
    if (barChart) {
      barChart.destroy()
      barChart = null
    }
  }

  return {
    root,
    update(counts, topRows) {
      destroyAll()
      doughSlot.replaceChildren()
      barSlot.replaceChildren()
      root.classList.remove('hidden')

      const total = counts.high + counts.medium + counts.low
      if (total === 0) {
        const empty = el('p', 'text-center text-sm text-slate-500')
        empty.textContent = 'No severity data for this scan.'
        append(doughSlot, empty)
      } else {
        const canvas = el('canvas', 'max-h-56 w-full max-w-md')
        append(doughSlot, canvas)
        doughChart = new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [
              {
                data: [counts.high, counts.medium, counts.low],
                backgroundColor: ['rgb(251 113 133 / 0.85)', 'rgb(251 191 36 / 0.85)', 'rgb(52 211 153 / 0.85)'],
                borderColor: ['rgb(15 23 42)', 'rgb(15 23 42)', 'rgb(15 23 42)'],
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: 'rgb(148 163 184)', padding: 12 },
              },
            },
          },
        })
      }

      const top = topRows.slice(0, 6)
      if (top.length === 0) {
        const empty = el('p', 'text-sm text-slate-500')
        empty.textContent = 'No rows to chart.'
        append(barSlot, empty)
        return
      }
      const labels = top.map((r) => (r.name.length > 28 ? `${r.name.slice(0, 26)}…` : r.name))
      const scores = top.map((r) => Number(r.score))
      const colors = top.map((r) => {
        const l = (r.riskLevel || 'Low').toLowerCase()
        if (l === 'high') return 'rgb(251 113 133 / 0.75)'
        if (l === 'medium') return 'rgb(251 191 36 / 0.75)'
        return 'rgb(52 211 153 / 0.75)'
      })
      const c2 = el('canvas', 'w-full')
      append(barSlot, c2)
      barChart = new Chart(c2, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Score',
              data: scores,
              backgroundColor: colors,
              borderColor: 'rgb(15 23 42)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: 'rgb(148 163 184)' },
              grid: { color: 'rgb(51 65 85 / 0.4)' },
            },
            y: {
              ticks: { color: 'rgb(203 213 225)', font: { size: 11 } },
              grid: { display: false },
            },
          },
          plugins: { legend: { display: false } },
        },
      })
    },
    clear() {
      destroyAll()
      root.classList.add('hidden')
      doughSlot.replaceChildren()
      barSlot.replaceChildren()
    },
  }
}

export function countSeverities(rows: { riskLevel: string }[]): SeverityCounts {
  let high = 0
  let medium = 0
  let low = 0
  for (const r of rows) {
    const l = (r.riskLevel || 'Low').toLowerCase()
    if (l === 'high') high += 1
    else if (l === 'medium') medium += 1
    else low += 1
  }
  return { high, medium, low }
}

export function topByScore(rows: ScanVulnerabilityRow[]): ScanVulnerabilityRow[] {
  return [...rows].sort((a, b) => Number(b.score) - Number(a.score))
}
