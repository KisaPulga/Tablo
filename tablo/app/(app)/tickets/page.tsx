'use client'

import { useState } from 'react'
import { useProfile } from '@/components/ProfileContext'
import { TicketCard } from '@/components/TicketCard'
import { Loading } from '@/components/ui'
import { fetchAll, must, sb, useLive, useNow } from '@/lib/live'
import { ALL_STATUSES, STATUS_LABEL, type DiningTable, type Profile, type TicketWithItems } from '@/lib/types'

export default function TicketsPage() {
  const me = useProfile()
  const now = useNow()
  const [tab, setTab] = useState<'mine' | 'all'>('mine')
  const [tableId, setTableId] = useState('')
  const [status, setStatus] = useState('actifs')
  const [waiterId, setWaiterId] = useState('')

  const { data, error } = useLive(
    async () => {
      const [tickets, tables, profiles] = await Promise.all([
        fetchAll<TicketWithItems>((from, to) =>
          sb().from('tickets').select('*, ticket_items(*)').order('created_at', { ascending: false }).range(from, to),
        ),
        sb().from('tables').select('*').order('sort_order'),
        sb().from('profiles').select('id, display_name, role').order('display_name'),
      ])
      return { tickets, tables: must(tables) as DiningTable[], profiles: must(profiles) as Profile[] }
    },
    { tables: ['tickets', 'ticket_items'] },
  )

  if (!data) return <Loading error={error} />

  const tableNames = new Map(data.tables.map((t) => [t.id, t.name]))
  const names = new Map(data.profiles.map((p) => [p.id, p.display_name]))

  const list = data.tickets.filter((t) => {
    if (tab === 'mine' && t.waiter_id !== me.id) return false
    if (tab === 'all' && waiterId && t.waiter_id !== waiterId) return false
    if (tableId && t.table_id !== tableId) return false
    if (status === 'actifs') return ['brouillon', 'envoye', 'en_preparation', 'pret'].includes(t.status)
    if (status && t.status !== status) return false
    return true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tickets</h1>

      <div className="grid grid-cols-2 gap-2">
        <button className={`btn ${tab === 'mine' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('mine')}>
          Mes tickets
        </button>
        <button className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('all')}>
          Tous les tickets
        </button>
      </div>

      <div className={`grid gap-2 ${tab === 'all' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Table">
          <option value="">Toutes tables</option>
          {data.tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut">
          <option value="actifs">En cours</option>
          <option value="">Tous statuts</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {tab === 'all' && (
          <select className="input" value={waiterId} onChange={(e) => setWaiterId(e.target.value)} aria-label="Serveur">
            <option value="">Tous serveurs</option>
            {data.profiles
              .filter((p) => p.role !== 'bar')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="space-y-3">
        {list.length === 0 && <p className="text-center text-muted">Aucun ticket.</p>}
        {list.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            tableName={tableNames.get(t.table_id)}
            waiterName={names.get(t.waiter_id)}
            now={now}
          />
        ))}
      </div>
    </div>
  )
}
