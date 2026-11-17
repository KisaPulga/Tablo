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

export const isPlaced = (t: DiningTable) => t.pos_x != null && t.pos_y != null

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
