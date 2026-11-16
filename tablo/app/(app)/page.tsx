'use client'

import Link from 'next/link'
import { Loading } from '@/components/ui'
import { formatPrice, itemsTotal } from '@/lib/format'
import { fetchAll, must, sb, useLive } from '@/lib/live'
import { isCounted, isOpen, type DiningTable, type TicketStatus } from '@/lib/types'

type Row = { table_id: string; status: TicketStatus; ticket_items: { quantity: number; unit_price_cents: number }[] }

export default function TablesPage() {
  const { data, error } = useLive(
    async () => {
      const [tables, tickets] = await Promise.all([
        sb().from('tables').select('id, name, sort_order, is_active').eq('is_active', true).order('sort_order').order('name'),
        fetchAll<Row>((from, to) =>
          sb()
            .from('tickets')
            .select('table_id, status, ticket_items(quantity, unit_price_cents)')
            .neq('status', 'annule')
            .order('created_at')
            .range(from, to),
        ),
      ])
      return { tables: must(tables) as DiningTable[], tickets }
    },
    { tables: ['tables', 'tickets', 'ticket_items'] },
  )

  if (!data) return <Loading error={error} />

  const stats = new Map<string, { open: number; total: number }>()
  for (const t of data.tickets) {
    const s = stats.get(t.table_id) ?? { open: 0, total: 0 }
    if (isOpen(t.status)) s.open++
    if (isCounted(t.status)) s.total += itemsTotal(t.ticket_items)
    stats.set(t.table_id, s)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tables</h1>
      {data.tables.length === 0 && (
        <p className="card p-4 text-muted">Aucune table. L&apos;admin peut en ajouter dans Admin → Tables.</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.tables.map((t) => {
          const s = stats.get(t.id)
          return (
            <Link
              key={t.id}
              href={`/table/${t.id}`}
              className="relative flex min-h-28 flex-col justify-between rounded-2xl border-2 border-white bg-surface p-4 active:scale-[0.97]"
            >
              <span className="text-xl leading-tight font-bold break-words">{t.name}</span>
              <span className="text-lg font-semibold text-muted">{formatPrice(s?.total ?? 0)}</span>
              {!!s?.open && (
                <span className="absolute -top-2 -right-2 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-accent px-2 text-sm font-bold">
                  {s.open}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
