import { itemsCount, itemsTotal } from '@/lib/format'
import { isCounted, type TicketWithItems } from '@/lib/types'

export type Lookup = {
  waiterName: (id: string) => string
  tableName: (id: string) => string
}

export type Agg = { key: string; label: string; tickets: number; items: number; cents: number }

function bump(map: Map<string, Agg>, key: string, label: string, items: number, cents: number, ticket = false) {
  const a = map.get(key) ?? { key, label, tickets: 0, items: 0, cents: 0 }
  a.items += items
  a.cents += cents
  if (ticket) a.tickets++
  map.set(key, a)
}

const byCents = (a: Agg, b: Agg) => b.cents - a.cents

/** Décompte : uniquement les tickets envoyés et non annulés */
export function computeDecompte(all: TicketWithItems[], lk: Lookup) {
  const tickets = all.filter((t) => isCounted(t.status))
  const byWaiter = new Map<string, Agg>()
  const byProduct = new Map<string, Agg>()
  const byTable = new Map<string, Agg>()
  const cross = new Map<string, Map<string, Agg>>() // serveur → produit
  const tableTickets = new Map<string, TicketWithItems[]>()

  for (const t of tickets) {
    const total = itemsTotal(t.ticket_items)
    const count = itemsCount(t.ticket_items)
    bump(byWaiter, t.waiter_id, lk.waiterName(t.waiter_id), count, total, true)
    bump(byTable, t.table_id, lk.tableName(t.table_id), count, total, true)
    tableTickets.set(t.table_id, [...(tableTickets.get(t.table_id) ?? []), t])
    const c = cross.get(t.waiter_id) ?? new Map<string, Agg>()
    for (const i of t.ticket_items) {
      const cents = i.quantity * i.unit_price_cents
      bump(byProduct, i.product_name, i.product_name, i.quantity, cents)
      bump(c, i.product_name, i.product_name, i.quantity, cents)
    }
    cross.set(t.waiter_id, c)
  }

  return {
    tickets,
    total: {
      tickets: tickets.length,
      items: tickets.reduce((s, t) => s + itemsCount(t.ticket_items), 0),
      cents: tickets.reduce((s, t) => s + itemsTotal(t.ticket_items), 0),
    },
    byWaiter: [...byWaiter.values()].sort(byCents),
    byProduct: [...byProduct.values()].sort(byCents),
    byTable: [...byTable.values()].sort(byCents),
    cross: new Map([...cross].map(([k, m]) => [k, [...m.values()].sort(byCents)])),
    tableTickets,
  }
}

export type StatsFilters = {
  from: number | null
  to: number | null
  waiterId: string
  bucketMinutes: 15 | 60
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const diff = (a: string | null, b: string | null) => (a && b ? new Date(b).getTime() - new Date(a).getTime() : null)

export function computeStats(all: TicketWithItems[], lk: Lookup, f: StatsFilters) {
  // tickets envoyés au moins une fois, dans la période et pour le serveur choisi
  const sent = all.filter((t) => {
    if (!t.sent_at) return false
    const ts = new Date(t.sent_at).getTime()
    if (f.from != null && ts < f.from) return false
    if (f.to != null && ts > f.to) return false
    if (f.waiterId && t.waiter_id !== f.waiterId) return false
    return true
  })
  const counted = sent.filter((t) => isCounted(t.status))

  const lines = counted.flatMap((t) => t.ticket_items.map((i) => ({ t, i, cents: i.quantity * i.unit_price_cents })))
  const ticketIds = new Set(lines.map((l) => l.t.id))
  const totalCents = lines.reduce((s, l) => s + l.cents, 0)
  const totalItems = lines.reduce((s, l) => s + l.i.quantity, 0)

  // ---- ventes par tranche horaire ----
  const bucketMs = f.bucketMinutes * 60000
  const buckets = new Map<number, { start: number; items: number; cents: number }>()
  for (const l of lines) {
    const start = Math.floor(new Date(l.t.sent_at!).getTime() / bucketMs) * bucketMs
    const b = buckets.get(start) ?? { start, items: 0, cents: 0 }
    b.items += l.i.quantity
    b.cents += l.cents
    buckets.set(start, b)
  }
  const timeline: { start: number; items: number; cents: number }[] = []
  if (buckets.size) {
    const starts = [...buckets.keys()]
    for (let s = Math.min(...starts); s <= Math.max(...starts); s += bucketMs) {
      timeline.push(buckets.get(s) ?? { start: s, items: 0, cents: 0 })
    }
  }

  // ---- produits / serveurs / tables ----
  const products = new Map<string, Agg>()
  const waiters = new Map<string, Agg>()
  const tables = new Map<string, Agg>()
  const seenW = new Set<string>()
  const seenT = new Set<string>()
  for (const l of lines) {
    bump(products, l.i.product_name, l.i.product_name, l.i.quantity, l.cents)
    bump(waiters, l.t.waiter_id, lk.waiterName(l.t.waiter_id), l.i.quantity, l.cents, !seenW.has(l.t.id))
    seenW.add(l.t.id)
    bump(tables, l.t.table_id, lk.tableName(l.t.table_id), l.i.quantity, l.cents, !seenT.has(l.t.id))
    seenT.add(l.t.id)
  }

  // ---- temps de service ----
  type Times = { toReady: number[]; toServed: number[] }
  const timesOf = (ts: TicketWithItems[]): Times => ({
    toReady: ts.map((t) => diff(t.sent_at, t.ready_at)).filter((x): x is number => x != null && x >= 0),
    toServed: ts.map((t) => diff(t.ready_at, t.served_at)).filter((x): x is number => x != null && x >= 0),
  })
  const g = timesOf(counted)
  const serviceGlobal = { toReady: avg(g.toReady), toServed: avg(g.toServed) }
  const waiterIds = [...new Set(counted.map((t) => t.waiter_id))]
  const serviceByWaiter = waiterIds
    .map((w) => {
      const x = timesOf(counted.filter((t) => t.waiter_id === w))
      return { id: w, name: lk.waiterName(w), toReady: avg(x.toReady), toServed: avg(x.toServed) }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  let longest: { ticket: TicketWithItems; ms: number } | null = null
  for (const t of counted) {
    const ms = diff(t.sent_at, t.served_at ?? t.ready_at)
    if (ms != null && (!longest || ms > longest.ms)) longest = { ticket: t, ms }
  }


  const nTickets = ticketIds.size
  return {
    totalCents,
    totalItems,
    nTickets,
    avgBasket: nTickets ? totalCents / nTickets : 0,
    avgItems: nTickets ? totalItems / nTickets : 0,
    timeline,
    products: [...products.values()],
    waiters: [...waiters.values()].sort(byCents),
    tables: [...tables.values()].sort(byCents),
    serviceGlobal,
    serviceByWaiter,
    longest,
  }
}
