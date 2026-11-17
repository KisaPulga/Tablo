'use client'

import { forwardRef } from 'react'
import type { DiningTable } from '@/lib/types'

/**
 * Fond du plan de salle : garde toujours le même format (aspect) pour que
 * les positions en % tombent au même endroit sur téléphone et tablette.
 */
export const FloorPlanCanvas = forwardRef<
  HTMLDivElement,
  { aspect: number; image: string | null; children: React.ReactNode; onPointerDown?: () => void }
>(function FloorPlanCanvas({ aspect, image, children, onPointerDown }, ref) {
  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="relative mx-auto overflow-hidden rounded-2xl border-2 border-line bg-surface"
      style={{
        aspectRatio: String(aspect),
        width: `min(100%, calc(72dvh * ${aspect}))`,
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

/** Style de positionnement d'une table sur le plan */
export function tableBoxStyle(t: Pick<DiningTable, 'pos_x' | 'pos_y' | 'width' | 'height'>): React.CSSProperties {
  return {
    left: `${t.pos_x ?? 0}%`,
    top: `${t.pos_y ?? 0}%`,
    width: `${t.width}%`,
    height: `${t.height}%`,
    // texte proportionnel à la taille du plan (unités de conteneur)
    fontSize: 'clamp(9px, 3.2cqw, 18px)',
  }
}
