'use client'

import { useCallback, useEffect, useState } from 'react'
import { must, sb } from '@/lib/live'
import type { DiningTable } from '@/lib/types'

export const DEFAULT_ASPECT = 3 / 4 // largeur / hauteur (portrait, adapté au téléphone)

export type PlanSettings = { image: string | null; aspect: number }

/** Image et format du plan (chargés une fois : l'image peut peser ~200 Ko) */
export function usePlanSettings() {
  const [settings, setSettings] = useState<PlanSettings | null>(null)

  const reload = useCallback(async () => {
    try {
      const rows = must(
        await sb().from('settings').select('key, value').in('key', ['floor_plan', 'floor_aspect']),
      ) as { key: string; value: string | null }[]
      const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null
      const aspect = Number(get('floor_aspect'))
      setSettings({ image: get('floor_plan'), aspect: aspect > 0 ? aspect : DEFAULT_ASPECT })
    } catch {
      // table settings absente (migration 06 pas faite) : plan vierge
      setSettings({ image: null, aspect: DEFAULT_ASPECT })
    }
  }, [])

  useEffect(() => {
    // chargement initial depuis Supabase (système externe)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  return { settings, reload }
}

export async function saveSetting(key: string, value: string | null) {
  must(
    await sb()
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select('key')
      .single(),
  )
}

/** Réduit une image (max 1400 px, JPEG) pour la stocker en base */
export function compressImage(file: File): Promise<{ dataUrl: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const max = 1400
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas indisponible'))
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.75), aspect: w / h })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible'))
    }
    img.src = url
  })
}

export const isPlaced = (t: DiningTable) => t.pos_x != null && t.pos_y != null

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
