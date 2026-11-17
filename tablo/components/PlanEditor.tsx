'use client'

import { useRef, useState } from 'react'
import { FloorPlanCanvas, tableBoxStyle } from '@/components/FloorPlan'
import { useToast } from '@/components/Toaster'
import { ConfirmButton } from '@/components/ui'
import { must, sb } from '@/lib/live'
import { clamp, compressImage, isPlaced, saveSetting, usePlanSettings } from '@/lib/plan'
import type { DiningTable } from '@/lib/types'

type Geo = Pick<DiningTable, 'pos_x' | 'pos_y' | 'width' | 'height' | 'shape'>

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
  const fileRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

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

  /** Glisser une table (mode move) ou sa poignée (mode resize) */
  function startDrag(e: React.PointerEvent, t: DiningTable, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelected(t.id)
    const start = geo(t)
    const sx = e.clientX
    const sy = e.clientY
    let latest: Partial<Geo> = {}
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100
      const dy = ((ev.clientY - sy) / rect.height) * 100
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true
      if (mode === 'move') {
        latest = {
          pos_x: clamp((start.pos_x ?? 0) + dx, 0, 100 - start.width),
          pos_y: clamp((start.pos_y ?? 0) + dy, 0, 100 - start.height),
        }
      } else {
        latest = {
          width: clamp(start.width + dx, MIN_SIZE, 100 - (start.pos_x ?? 0)),
          height: clamp(start.height + dy, MIN_SIZE, 100 - (start.pos_y ?? 0)),
        }
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

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const ok = await toast.attempt('Image du plan', async () => {
      const { dataUrl, aspect } = await compressImage(file)
      await saveSetting('floor_plan', dataUrl)
      await saveSetting('floor_aspect', String(aspect))
    })
    setUploading(false)
    if (ok) {
      toast.success('Plan importé ✔')
      void reloadSettings()
    }
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
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <button className="btn btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Import…' : settings.image ? "Changer l'image du plan" : '🖼 Importer une image du plan'}
        </button>
        {settings.image ? (
          <ConfirmButton className="btn btn-sm btn-ghost" onConfirm={removeImage}>
            Retirer l&apos;image
          </ConfirmButton>
        ) : (
          ASPECTS.map((a) => (
            <button
              key={a.label}
              className={`btn btn-sm ${Math.abs(settings.aspect - a.value) < 0.01 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAspect(a.value)}
            >
              {a.label}
            </button>
          ))
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
              <span className="pointer-events-none overflow-hidden">{t.name}</span>
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
          Glisse une table pour la déplacer. Touche-la pour la sélectionner, puis tire la poignée ⤡ pour changer sa taille.
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
