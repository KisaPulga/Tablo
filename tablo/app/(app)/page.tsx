'use client'

import Link from 'next/link'
import { FloorPlanCanvas, labelStyle, NoPageBounce, PLAN_FIT_HEIGHT, tableBoxStyle } from '@/components/FloorPlan'
import { useProfile } from '@/components/ProfileContext'
import { Loading } from '@/components/ui'
import { formatPrice, itemsTotal } from '@/lib/format'
import { fetchAll, must, sb, useLive } from '@/lib/live'
import { isPlaced, usePlanSettings } from '@/lib/plan'
import { isCounted, isOpen, type DiningTable, type TicketStatus } from '@/lib/types'

type Row = { table_id: string; status: TicketStatus; ticket_items: { quantity: number; unit_price_cents: number }[] }
type Stat = { open: number; total: number }

export default function TablesPage() {
  const me = useProfile()
  const { settings } = usePlanSettings()
  const { data, error } = useLive(
    async () => {
      const [tables, tickets] = await Promise.all([
        sb().from('tables').select('*').eq('is_active', true).order('sort_order').order('name'),
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

  if (!data || !settings) return <Loading error={error} />

  const stats = new Map<string, Stat>()
  for (const t of data.tickets) {
    const s = stats.get(t.table_id) ?? { open: 0, total: 0 }
    if (isOpen(t.status)) s.open++
    if (isCounted(t.status)) s.total += itemsTotal(t.ticket_items)
    stats.set(t.table_id, s)
  }

  const placed = data.tables.filter(isPlaced)

  return (
    // -mb-9 : compense la grande marge du bas de la page pour que le plan tienne sans faire défiler
    <div className={`space-y-4 ${placed.length > 0 ? '-mb-9' : ''}`}>
      <h1 className="text-2xl font-bold">Tables</h1>
      {data.tables.length === 0 && (
        <p className="card p-4 text-muted">Aucune table. L&apos;admin peut en ajouter dans Admin → Tables.</p>
      )}

      {/* ---------- plan de salle ---------- */}
      {placed.length > 0 && <NoPageBounce />}
      {placed.length > 0 && (
        <FloorPlanCanvas aspect={settings.aspect} image={settings.image} maxHeight={PLAN_FIT_HEIGHT}>
          {placed.map((t) => {
            const s = stats.get(t.id)
            return (
              <Link
                key={t.id}
                href={`/table/${t.id}`}
                className={`absolute flex flex-col items-center justify-center border-2 border-white p-0.5 text-center leading-tight active:scale-95 ${
                  t.shape === 'round' ? 'rounded-full' : 'rounded-lg'
                } ${s?.open ? 'bg-accent' : 'bg-surface-2/90'}`}
                style={tableBoxStyle(t)}
              >
                <span className="flex flex-col items-center overflow-hidden" style={labelStyle(t.rotation)}>
                  <span className="font-bold break-words">{t.name}</span>
                  {!!s?.total && <span className="text-[0.8em] text-white/80">{formatPrice(s.total)}</span>}
                </span>
                {!!s?.open && (
                  <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-amber-400 px-1 text-xs font-black text-amber-950">
                    {s.open}
                  </span>
                )}
              </Link>
            )
          })}
        </FloorPlanCanvas>
      )}
      {placed.length === 0 && data.tables.length > 0 && me.role === 'admin' && (
        <p className="text-sm text-muted">
          Astuce : place les tables sur le plan dans{' '}
          <Link href="/admin/tables" className="underline">
            Admin → Tables → Plan de salle
          </Link>
          .
        </p>
      )}

      {/* ---------- secours : aucune table placée → grille de tuiles ---------- */}
      {placed.length === 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.tables.map((t) => (
            <TableTile key={t.id} table={t} stat={stats.get(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TableTile({ table: t, stat: s }: { table: DiningTable; stat?: Stat }) {
  return (
    <Link
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
}
