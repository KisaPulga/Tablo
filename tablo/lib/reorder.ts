import { must, sb } from '@/lib/live'

/**
 * Déplace l'élément `index` de `delta` (-1 / +1) et réécrit les sort_order
 * de toute la liste (0, 10, 20…). Les listes sont courtes, c'est suffisant.
 */
export async function moveRow(table: string, rows: { id: string }[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= rows.length) return
  const next = [...rows]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  await Promise.all(
    next.map(async (r, i) => {
      must(await sb().from(table).update({ sort_order: i * 10 }).eq('id', r.id).select('id').single())
    }),
  )
}
