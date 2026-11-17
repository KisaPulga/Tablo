'use client'

import { forwardRef, useEffect } from 'react'
import type { DiningTable } from '@/lib/types'

/**
 * Fond du plan de salle : garde toujours le même format (aspect) pour que
 * les positions en % tombent au même endroit sur téléphone et tablette.
 */
export const FloorPlanCanvas = forwardRef<
  HTMLDivElement,
  {
    aspect: number
    image: string | null
    children: React.ReactNode
    onPointerDown?: () => void
    /** hauteur maximale du plan (CSS), 72dvh par défaut */
    maxHeight?: string
  }
>(function FloorPlanCanvas({ aspect, image, children, onPointerDown, maxHeight = '72dvh' }, ref) {
  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="relative mx-auto overflow-hidden rounded-2xl border-2 border-line bg-surface"
      style={{
        aspectRatio: String(aspect),
        width: `min(100%, calc((${maxHeight}) * ${aspect}))`,
        containerType: 'inline-size',
      }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Plan de la salle" className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none" draggable={false} />
      )}
      {children}
    </div>
  )
})

/**
 * Supprime l'effet élastique (rebond) de la page tant que ce composant est affiché.
 * Le défilement reste possible seulement si le contenu dépasse vraiment (ex. bandeau « Prêt »).
 */
export function NoPageBounce() {
  useEffect(() => {
    const els = [document.documentElement, document.body]
    const prev = els.map((el) => el.style.overscrollBehavior)
    for (const el of els) el.style.overscrollBehavior = 'none'
    return () => els.forEach((el, i) => (el.style.overscrollBehavior = prev[i]))
  }, [])
  return null
}

/** Hauteur max du plan sur l'écran Tables : tout l'écran moins en-tête, titre et barre du bas */
export const PLAN_FIT_HEIGHT =
  '100dvh - 15rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)'

/** Style de positionnement d'une table sur le plan */
export function tableBoxStyle(
  t: Pick<DiningTable, 'pos_x' | 'pos_y' | 'width' | 'height'> & { rotation?: number | null },
): React.CSSProperties {
  return {
    left: `${t.pos_x ?? 0}%`,
    top: `${t.pos_y ?? 0}%`,
    width: `${t.width}%`,
    height: `${t.height}%`,
    transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
    transformOrigin: 'center',
    // texte proportionnel à la taille du plan (unités de conteneur)
    fontSize: 'clamp(9px, 3.2cqw, 18px)',
  }
}

/** Retourne le texte s'il se retrouverait à l'envers (table tournée de plus de 90°) */
export function labelStyle(rotation?: number | null): React.CSSProperties | undefined {
  const r = (((rotation ?? 0) % 360) + 360) % 360
  return r > 90 && r <= 270 ? { transform: 'rotate(180deg)' } : undefined
}
