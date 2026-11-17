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

  const isAdmin = me.role === 'admin'
  // admin : poubelle sur tous les tickets (même annulés) = suppression définitive
  // serveur : poubelle sur ses tickets non servis = annulation (gardé en base, sort du décompte)
  const canDelete = isAdmin || (mine && ticket.status !== 'servi' && ticket.status !== 'annule')

  async function remove() {
    const ok = await toast.attempt('Suppression du ticket', async () => {
      if (isAdmin) {
        // fonction SQL réservée à l'admin (les lignes du ticket sont supprimées en cascade)
        must(await sb().rpc('delete_ticket', { p_ticket_id: ticket.id }))
      } else {
        must(await sb().from('tickets').update({ status: 'annule' }).eq('id', ticket.id).select('id').single())
      }
    })
    if (ok) toast.success(`Ticket #${ticket.number} supprimé`)
  }

  return (
    <div className={`card relative ${mine ? 'border-l-4 border-l-white' : ''} ${cancelled ? 'opacity-50' : ''}`}>
      <Link href={`/ticket/${ticket.id}`} className="block p-4 active:scale-[0.99]">
        <div className={`flex flex-wrap items-center gap-2 ${canDelete ? 'pr-12' : ''}`}>
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
          <ConfirmButton className="btn btn-sm btn-danger min-w-11 px-2" confirmLabel="Sûr ?" onConfirm={remove}>
            <svg
              aria-label="Supprimer"
              role="img"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </ConfirmButton>
        </div>
      )}
    </div>
  )
}
