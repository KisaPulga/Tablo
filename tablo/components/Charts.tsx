'use client'

import { useState } from 'react'

// Une seule série par graphique → une seule teinte (bleu clair, lisible sur fond sombre)
const BAR = '#5b93ff'

/** Classement horizontal : libellé, barre proportionnelle, valeur écrite */
export function BarList({
  rows,
  format,
  share,
}: {
  rows: { key: string; label: string; value: number; sub?: string }[]
  format: (v: number) => string
  /** affiche la part en % du total */
  share?: boolean
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  if (rows.length === 0) return <p className="text-sm text-muted">Aucune donnée.</p>
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {format(r.value)}
              {share && total > 0 && <span className="text-muted"> · {Math.round((r.value / total) * 100)} %</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: BAR }} />
          </div>
          {r.sub && <div className="mt-0.5 text-xs text-muted">{r.sub}</div>}
        </li>
      ))}
    </ul>
  )
}

/** Histogramme temporel avec info-bulle au survol / toucher */
export function TimeChart({
  points,
  format,
  label,
}: {
  points: { start: number; value: number; detail: string }[]
  format: (v: number) => string
  label: string
}) {
  const [active, setActive] = useState<number | null>(null)
  if (points.length === 0) return <p className="text-sm text-muted">Aucune vente sur la période.</p>
  const max = Math.max(1, ...points.map((p) => p.value))
  const hhmm = (ts: number) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const step = Math.max(1, Math.ceil(points.length / 8)) // ~8 étiquettes max sur l'axe
  const a = active != null ? points[active] : null

  return (
    <div>
      <div className="mb-1 flex h-6 items-baseline justify-between text-xs text-muted">
        <span>
          {label} · max {format(max)}
        </span>
        {a && (
          <span className="font-semibold text-foreground">
            {hhmm(a.start)} : {format(a.value)} <span className="font-normal text-muted">({a.detail})</span>
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <div
          className="flex h-44 items-end gap-0.5 border-b border-line"
          style={{ minWidth: `${points.length * 14}px` }}
          onMouseLeave={() => setActive(null)}
        >
          {points.map((p, i) => (
            <button
              key={p.start}
              type="button"
              aria-label={`${hhmm(p.start)} : ${format(p.value)}`}
              className="flex h-full flex-1 items-end"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <span
                className="w-full rounded-t"
                style={{
                  height: `${(p.value / max) * 100}%`,
                  minHeight: p.value > 0 ? 2 : 0,
                  background: BAR,
                  opacity: active == null || active === i ? 1 : 0.45,
                }}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 pt-1 text-[10px] text-muted" style={{ minWidth: `${points.length * 14}px` }}>
          {points.map((p, i) => (
            <span key={p.start} className="flex-1 text-center whitespace-nowrap">
              {i % step === 0 ? hhmm(p.start) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
