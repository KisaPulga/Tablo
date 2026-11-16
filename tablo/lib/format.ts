const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export function formatPrice(cents: number) {
  return euro.format(cents / 100)
}

/** "3,50" ou "3.5" → 350 ; null si invalide */
export function parsePrice(input: string): number | null {
  const n = Number(input.replace(',', '.').replace(/[^\d.]/g, ''))
  if (!input.trim() || Number.isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** "à l'instant", "il y a 4 min", "il y a 1 h 05" */
export function formatAgo(iso: string | null | undefined, now: number) {
  if (!iso) return ''
  const min = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  return `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** Minutes écoulées (pour l'écran bar) */
export function minutesSince(iso: string | null | undefined, now: number) {
  if (!iso) return 0
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

/** Durée en ms → "4 min 12 s" */
export function formatDuration(ms: number | null) {
  if (ms == null || Number.isNaN(ms)) return '–'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

export function itemsTotal(items: { quantity: number; unit_price_cents: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0)
}

export function itemsCount(items: { quantity: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

/** Téléchargement d'un CSV (séparateur « ; » + BOM pour Excel FR) */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c)
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Montant CSV : "12,50" */
export function csvEuros(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}
