'use client'

import { useRef, useState } from 'react'
import { FloorPlanCanvas, labelStyle, tableBoxStyle } from '@/components/FloorPlan'
import { useToast } from '@/components/Toaster'
import { ConfirmButton } from '@/components/ui'
import { must, sb } from '@/lib/live'
import { clamp, isPlaced, saveSetting, usePlanSettings } from '@/lib/plan'
import type { DiningTable } from '@/lib/types'

type Geo = Pick<DiningTable, 'pos_x' | 'pos_y' | 'width' | 'height' | 'shape' | 'rotation'>

/** Angle ramené entre 0 et 359, arrondi à 5° (aimanté sur 0/45/90… à ±4°) */
function normAngle(a: number) {
  let r = ((Math.round(a / 5) * 5) % 360 + 360) % 360
  const snap = Math.round(r / 45) * 45
  if (Math.abs(r - snap) <= 4) r = snap % 360
  return r
}

const MIN_SIZE = 4 // %

const ASPECTS = [
  { label: 'Portrait', value: 3 / 4 },
  { label: 'Carré', value: 1 },
  { label: 'Paysage', value: 4 / 3 },
]

export function PlanEditor({ tables, reload }: { tables: DiningTable[]; reload: () => void }) {
  const toast = useToast()
  const { settings, reload: reloadSettings } = usePlanSettings()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // modifications locales en cours (déplacement / redimensionnement), prioritaires sur la base
  const [overrides, setOverrides] = useState<Record<string, Partial<Geo>>>({})
  const geo = (t: DiningTable): DiningTable => ({ ...t, ...overrides[t.id] })

  const placed = tables.filter((t) => isPlaced(geo(t)))
  const unplaced = tables.filter((t) => !isPlaced(geo(t)))
  const sel = tables.find((t) => t.id === selected)
  const selGeo = sel ? geo(sel) : null

  async function persist(id: string, patch: Partial<Geo>) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }))
    const ok = await toast.attempt('Plan', async () => {
      must(await sb().from('tables').update(patch).eq('id', id).select('id').single())
    })
    if (ok) {
      reload()
      // la base est à jour : on retire la surcharge locale un peu plus tard (le temps du rechargement)
      setTimeout(
        () =>
          setOverrides((o) => {
            const n = { ...o }
            delete n[id]
            return n
          }),
        1500,
      )
    }
  }

  /** Glisser une table (move), sa poignée de taille (resize) ou de rotation (rotate) */
  function startDrag(e: React.PointerEvent, t: DiningTable, mode: 'move' | 'resize' | 'rotate') {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelected(t.id)
    const start = geo(t)
    const sx = e.clientX
    const sy = e.clientY
    // centre de la table à l'écran (pour la rotation)
    const cx = rect.left + (((start.pos_x ?? 0) + start.width / 2) / 100) * rect.width
    const cy = rect.top + (((start.pos_y ?? 0) + start.height / 2) / 100) * rect.height
    const rad = ((start.rotation ?? 0) * Math.PI) / 180
    let latest: Partial<Geo> = {}
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const pxX = ev.clientX - sx
      const pxY = ev.clientY - sy
      if (Math.abs(pxX) + Math.abs(pxY) > 3) moved = true
      if (mode === 'move') {
        latest = {
          pos_x: clamp((start.pos_x ?? 0) + (pxX / rect.width) * 100, 0, 100 - start.width),
          pos_y: clamp((start.pos_y ?? 0) + (pxY / rect.height) * 100, 0, 100 - start.height),
        }
      } else if (mode === 'resize') {
        // déplacement exprimé dans le repère (tourné) de la table
        const lx = pxX * Math.cos(rad) + pxY * Math.sin(rad)
        const ly = -pxX * Math.sin(rad) + pxY * Math.cos(rad)
        latest = {
          width: clamp(start.width + (lx / rect.width) * 100, MIN_SIZE, 100 - (start.pos_x ?? 0)),
          height: clamp(start.height + (ly / rect.height) * 100, MIN_SIZE, 100 - (start.pos_y ?? 0)),
        }
      } else {
        // la poignée est au-dessus de la table : angle 0 = doigt pile au-dessus du centre
        const deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
        latest = { rotation: normAngle(deg) }
      }
      setOverrides((o) => ({ ...o, [t.id]: { ...o[t.id], ...latest } }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (moved) void persist(t.id, round(latest))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function place(t: DiningTable) {
    // place la table au centre, décalée selon le nombre déjà placé pour ne pas les empiler
    const n = placed.length
    const x = clamp(50 - t.width / 2 + ((n % 5) - 2) * 4, 0, 100 - t.width)
    const y = clamp(50 - t.height / 2 + ((Math.floor(n / 5) % 5) - 2) * 4, 0, 100 - t.height)
    setSelected(t.id)
    void persist(t.id, round({ pos_x: x, pos_y: y }))
  }

  function nudgeSize(delta: number) {
    if (!sel || !selGeo) return
    void persist(
      sel.id,
      round({
        width: clamp(selGeo.width + delta, MIN_SIZE, 100 - (selGeo.pos_x ?? 0)),
        height: clamp(selGeo.height + delta, MIN_SIZE, 100 - (selGeo.pos_y ?? 0)),
      }),
    )
  }

  async function setAspect(aspect: number) {
    const ok = await toast.attempt('Format du plan', () => saveSetting('floor_aspect', String(aspect)))
    if (ok) void reloadSettings()
  }

  async function removeImage() {
    const ok = await toast.attempt("Suppression de l'image", () => saveSetting('floor_plan', null))
    if (ok) void reloadSettings()
  }

  if (!settings) return <p className="p-8 text-center text-muted">Chargement du plan…</p>

  return (
    <div className="space-y-4">
      {/* ---------- fond du plan ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Format :</span>
        {ASPECTS.map((a) => (
          <button
            key={a.label}
            className={`btn btn-sm ${Math.abs(settings.aspect - a.value) < 0.01 ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setAspect(a.value)}
          >
            {a.label}
          </button>
        ))}
        {/* image importée auparavant : on peut encore la retirer */}
        {settings.image && (
          <ConfirmButton className="btn btn-sm btn-ghost" onConfirm={removeImage}>
            Retirer l&apos;image
          </ConfirmButton>
        )}
      </div>

      {/* ---------- plan ---------- */}
      <FloorPlanCanvas ref={canvasRef} aspect={settings.aspect} image={settings.image} onPointerDown={() => setSelected(null)}>
        {placed.map((raw) => {
          const t = geo(raw)
          const isSel = t.id === selected
          return (
            <div
              key={t.id}
              onPointerDown={(e) => startDrag(e, t, 'move')}
              className={`absolute flex touch-none items-center justify-center border-2 bg-accent/85 p-0.5 text-center leading-tight font-bold break-words select-none ${
                t.shape === 'round' ? 'rounded-full' : 'rounded-lg'
              } ${isSel ? 'z-10 border-white ring-4 ring-white/40' : 'border-white/80'}`}
              style={{ ...tableBoxStyle(t), cursor: 'grab' }}
            >
              <span className="pointer-events-none overflow-hidden" style={labelStyle(t.rotation)}>
                {t.name}
              </span>
              {isSel && (
                <>
                  <span aria-hidden className="pointer-events-none absolute -top-6 left-1/2 h-6 w-0.5 -translate-x-1/2 bg-white" />
                  <span
                    onPointerDown={(e) => startDrag(e, t, 'rotate')}
                    aria-label="Tourner"
                    className="absolute -top-10 left-1/2 flex h-7 w-7 -translate-x-1/2 touch-none items-center justify-center rounded-full border-2 border-background bg-white text-sm text-background"
                    style={{ cursor: 'grab' }}
                  >
                    ⟳
                  </span>
                </>
              )}
              {isSel && (
                <span
                  onPointerDown={(e) => startDrag(e, t, 'resize')}
                  aria-label="Redimensionner"
                  className="absolute -right-3 -bottom-3 flex h-7 w-7 touch-none items-center justify-center rounded-full border-2 border-background bg-white text-xs text-background"
                  style={{ cursor: 'nwse-resize' }}
                >
                  ⤡
                </span>
              )}
            </div>
          )
        })}
      </FloorPlanCanvas>

      {/* ---------- table sélectionnée ---------- */}
      {sel && selGeo && isPlaced(selGeo) ? (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="font-bold">{sel.name}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>
              OK
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-sm h-9 w-9 p-0" onClick={() => nudgeSize(-1)} aria-label="Plus petite">
              −
            </button>
            <span className="text-sm text-muted">Taille</span>
            <button className="btn btn-sm h-9 w-9 p-0" onClick={() => nudgeSize(1)} aria-label="Plus grande">
              +
            </button>
            <span className="mx-1 h-6 w-px bg-line" />
            <button
              className="btn btn-sm h-9 w-9 p-0"
              onClick={() => persist(sel.id, { rotation: normAngle((selGeo.rotation ?? 0) - 15) })}
              aria-label="Tourner à gauche"
            >
              ↺
            </button>
            <span className="w-10 text-center text-sm text-muted tabular-nums">{Math.round(selGeo.rotation ?? 0)}°</span>
            <button
              className="btn btn-sm h-9 w-9 p-0"
              onClick={() => persist(sel.id, { rotation: normAngle((selGeo.rotation ?? 0) + 15) })}
              aria-label="Tourner à droite"
            >
              ↻
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => persist(sel.id, { shape: selGeo.shape === 'round' ? 'rect' : 'round' })}
            >
              {selGeo.shape === 'round' ? '▢ Carrée' : '◯ Ronde'}
            </button>
            <button className="btn btn-sm btn-danger ml-auto" onClick={() => persist(sel.id, { pos_x: null, pos_y: null })}>
              Retirer du plan
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Glisse une table pour la déplacer. Touche-la pour la sélectionner : la poignée ⤡ change sa taille, la poignée ⟳ la
          fait tourner.
        </p>
      )}

      {/* ---------- tables à placer ---------- */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold tracking-wide text-muted uppercase">À placer ({unplaced.length})</h2>
        {unplaced.length === 0 ? (
          <p className="text-sm text-muted">Toutes les tables sont sur le plan.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unplaced.map((t) => (
              <button key={t.id} className="btn btn-sm" onClick={() => place(t)}>
                + {t.name}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function round(g: Partial<Geo>): Partial<Geo> {
  const r = (v: number | null | undefined) => (v == null ? v : Math.round(v * 10) / 10)
  const out: Partial<Geo> = { ...g }
  if ('pos_x' in g) out.pos_x = r(g.pos_x) as number | null
  if ('pos_y' in g) out.pos_y = r(g.pos_y) as number | null
  if ('width' in g) out.width = r(g.width) as number
  if ('height' in g) out.height = r(g.height) as number
  return out
}
