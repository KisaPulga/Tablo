'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useProfile } from '@/components/ProfileContext'
import { TicketCard } from '@/components/TicketCard'
import { useToast } from '@/components/Toaster'
import { Loading } from '@/components/ui'
import { formatPrice, itemsTotal } from '@/lib/format'
import { must, sb, useLive, useNow } from '@/lib/live'
import { isCounted, type DiningTable, type Profile, type TicketWithItems } from '@/lib/types'

export default function TablePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const me = useProfile()
  const toast = useToast()
  const now = useNow()
  const [creating, setCreating] = useState(false)

  const { data, error } = useLive(
    async () => {
      const [table, tickets, profiles] = await Promise.all([
        sb().from('tables').select('*').eq('id', id).maybeSingle(),
        sb().from('tickets').select('*, ticket_items(*)').eq('table_id', id).order('created_at', { ascending: false }),
        sb().from('profiles').select('id, display_name, role'),
      ])
      return {
        table: must(table) as DiningTable | null,
        tickets: must(tickets) as TicketWithItems[],
        profiles: must(profiles) as Profile[],
      }
    },
    { tables: ['tickets', 'ticket_items', 'tables'], key: id },
  )

  if (!data) return <Loading error={error} />
  if (!data.table) return <p className="card p-4">Table introuvable.</p>

  const names = new Map(data.profiles.map((p) => [p.id, p.display_name]))
  const counted = data.tickets.filter((t) => isCounted(t.status))
  const visible = data.tickets.filter((t) => t.status !== 'annule') // tickets supprimés masqués
  const total = counted.reduce((s, t) => s + itemsTotal(t.ticket_items), 0)

  // détail par serveur
  const byWaiter = new Map<string, number>()
  for (const t of counted) byWaiter.set(t.waiter_id, (byWaiter.get(t.waiter_id) ?? 0) + itemsTotal(t.ticket_items))

  async function newTicket() {
    setCreating(true)
    let ticketId: string | null = null
    const ok = await toast.attempt('Création du ticket', async () => {
      const row = must(
        await sb().from('tickets').insert({ table_id: id, waiter_id: me.id }).select('id').single(),
      ) as { id: string }
      ticketId = row.id
    })
    setCreating(false)
    if (ok && ticketId) router.push(`/ticket/${ticketId}`)
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted">
        ← Tables
      </Link>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">{data.table.name}</h1>
        <div className="text-right">
          <div className="text-xs text-muted uppercase">Addition</div>
          <div className="text-2xl font-bold">{formatPrice(total)}</div>
        </div>
      </div>

      {byWaiter.size > 1 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          {[...byWaiter].map(([w, c]) => (
            <span key={w} className="rounded-full border border-line px-2 py-0.5">
              {names.get(w) ?? '?'} : {formatPrice(c)}
            </span>
          ))}
        </div>
      )}

      <button className="btn btn-primary w-full py-4 text-lg" onClick={newTicket} disabled={creating}>
        {creating ? 'Création…' : '+ Nouveau ticket'}
      </button>

      <div className="space-y-3">
        {visible.length === 0 && <p className="text-center text-muted">Aucun ticket pour cette table.</p>}
        {visible.map((t) => (
          <TicketCard key={t.id} ticket={t} waiterName={names.get(t.waiter_id)} now={now} />
        ))}
      </div>
    </div>
  )
}
