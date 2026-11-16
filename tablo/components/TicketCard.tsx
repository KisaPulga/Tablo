'use client'

import Link from 'next/link'
import { StatusChip } from '@/components/ui'
import { formatAgo, formatPrice, formatTime, itemsTotal } from '@/lib/format'
import type { TicketWithItems } from '@/lib/types'

export function TicketCard({
  ticket,
  tableName,
  waiterName,
  now,
  mine,
}: {
  ticket: TicketWithItems
  tableName?: string
  waiterName?: string
  now: number
  mine?: boolean
}) {
  const items = [...ticket.ticket_items].sort((a, b) => a.position - b.position)
  const cancelled = ticket.status === 'annule'
  return (
    <Link
      href={`/ticket/${ticket.id}`}
      className={`card block p-4 active:scale-[0.99] ${mine ? 'border-l-4 border-l-white' : ''} ${cancelled ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
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
      {ticket.note && <p className="mt-1 text-sm text-amber-300">📝 {ticket.note}</p>}
    </Link>
  )
}
