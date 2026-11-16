'use client'

import Link from 'next/link'
import { useProfile } from '@/components/ProfileContext'
import { useToast } from '@/components/Toaster'
import { ConfirmButton, StatusChip } from '@/components/ui'
import { formatAgo, formatPrice, formatTime, itemsTotal } from '@/lib/format'
import { must, sb } from '@/lib/live'
import type { TicketWithItems } from '@/lib/types'

export function TicketCard({
  ticket,
  tableName,
  waiterName,
  now,
}: {
  ticket: TicketWithItems
  tableName?: string
  waiterName?: string
  now: number
}) {
  const me = useProfile()
  const toast = useToast()
  const mine = ticket.waiter_id === me.id
  const items = [...ticket.ticket_items].sort((a, b) => a.position - b.position)
  const cancelled = ticket.status === 'annule'

  // « Supprimer » = annuler : le ticket est gardé en base (traçabilité) mais sort du décompte
  const canDelete =
    (mine && ticket.status !== 'servi' && ticket.status !== 'annule') || (me.role === 'admin' && ticket.status !== 'annule')

  async function remove() {
    const ok = await toast.attempt('Suppression du ticket', async () => {
      must(await sb().from('tickets').update({ status: 'annule' }).eq('id', ticket.id).select('id').single())
    })
    if (ok) toast.success(`Ticket #${ticket.number} supprimé`)
  }

  return (
    <div className={`card relative ${mine ? 'border-l-4 border-l-white' : ''} ${cancelled ? 'opacity-50' : ''}`}>
      <Link href={`/ticket/${ticket.id}`} className="block p-4 active:scale-[0.99]">
        <div className={`flex flex-wrap items-center gap-2 ${canDelete ? 'pr-24' : ''}`}>
          <span className="font-bold">#{ticket.number}</span>
          {tableName && <span className="font-semibold">{tableName}</span>}
          <StatusChip status={ticket.status} />
          <span className="ml-auto text-sm font-bold">{formatPrice(itemsTotal(items))}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          {waiterName && <>{waiterName} · </>}
          {formatTime(ticket.created_at)} · {formatAgo(ticket.sent_at ?? ticket.created_at, now)}
        </div>
        {items.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-sm">
            {items.map((i) => (
              <li key={i.id}>
                <span className="font-bold">{i.quantity}×</span> {i.product_name}
                {i.note && <span className="text-amber-300"> — {i.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted italic">Ticket vide</p>
        )}
      </Link>
      {canDelete && (
        <div className="absolute top-3 right-3">
          <ConfirmButton className="btn btn-sm btn-danger" confirmLabel="Sûr ?" onConfirm={remove}>
            Supprimer
          </ConfirmButton>
        </div>
      )}
    </div>
  )
}
