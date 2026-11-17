'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toaster'
import { PlanEditor } from '@/components/PlanEditor'
import { ConfirmButton, Loading } from '@/components/ui'
import { must, sb, useLive } from '@/lib/live'
import { moveRow } from '@/lib/reorder'
import type { DiningTable } from '@/lib/types'

export default function AdminTablesPage() {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [tab, setTab] = useState<'list' | 'plan'>('list')

  const { data, error, reload } = useLive(
    async () =>
      must(
        await sb().from('tables').select('*').eq('is_active', true).order('sort_order').order('name'),
      ) as DiningTable[],
    { tables: ['tables'] },
  )

  if (!data) return <Loading error={error} />

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const sort = data!.length ? Math.max(...data!.map((t) => t.sort_order)) + 10 : 0
    const ok = await toast.attempt('Ajout de la table', async () => {
      must(await sb().from('tables').insert({ name, sort_order: sort }).select('id').single())
    })
    if (ok) setNewName('')
    reload()
  }

  async function rename(t: DiningTable, name: string) {
    name = name.trim()
    if (!name || name === t.name) return
    await toast.attempt('Renommage', async () => {
      must(await sb().from('tables').update({ name }).eq('id', t.id).select('id').single())
    })
    reload()
  }

  async function remove(t: DiningTable) {
    await toast.attempt('Suppression', async () => {
      // une table qui a des tickets est seulement masquée (on garde l'historique)
      const res = await sb().from('tables').delete().eq('id', t.id)
      if (res.error?.code === '23503') {
        must(await sb().from('tables').update({ is_active: false }).eq('id', t.id).select('id').single())
      } else must(res)
    })
    reload()
  }

  async function move(i: number, delta: number) {
    await toast.attempt('Réordonner', () => moveRow('tables', data!, i, delta))
    reload()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tables</h1>

      <div className="grid grid-cols-2 gap-2">
        <button className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('list')}>
          Liste ({data.length})
        </button>
        <button className={`btn ${tab === 'plan' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('plan')}>
          Plan de salle
        </button>
      </div>

      {tab === 'plan' ? (
        <PlanEditor tables={data} reload={reload} />
      ) : (
        <>
          <form onSubmit={add} className="flex gap-2">
            <input
              className="input"
              placeholder="Nom de la table (ex. Terrasse 3)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn btn-primary shrink-0" disabled={!newName.trim()}>
              Ajouter
            </button>
          </form>

          <ul className="space-y-2">
            {data.map((t, i) => (
              <li key={t.id} className="card flex items-center gap-2 p-2">
                <div className="flex flex-col">
                  <button
                    className="btn btn-sm btn-ghost px-2"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Monter"
                  >
                    ▲
                  </button>
                  <button
                    className="btn btn-sm btn-ghost mt-1 px-2"
                    disabled={i === data.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Descendre"
                  >
                    ▼
                  </button>
                </div>
                <input
                  key={t.name}
                  className="input flex-1 font-semibold"
                  defaultValue={t.name}
                  onBlur={(e) => rename(t, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  aria-label="Nom de la table"
                />
                <ConfirmButton className="btn btn-sm btn-danger" onConfirm={() => remove(t)}>
                  Suppr.
                </ConfirmButton>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Une table qui a déjà des tickets est masquée plutôt que supprimée, pour garder le décompte juste.
          </p>
        </>
      )}
    </div>
  )
}
