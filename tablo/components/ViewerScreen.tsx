'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusChip } from '@/components/ui'
import { formatPrice, formatTime, itemsCount, itemsTotal } from '@/lib/format'
import { fetchAll, must, sb } from '@/lib/live'
import { computeDecompte, type Agg, type Lookup } from '@/lib/stats'
import { isCounted, type DiningTable, type Profile, type TicketWithItems } from '@/lib/types'

/** Écran en lecture seule : historique des ventes + podiums, rafraîchi toutes les 5 s */

const REFRESH_SECONDS = 5

type Data = {
  tickets: TicketWithItems[]
  profiles: Pick<Profile, 'id' | 'display_name' | 'role'>[]
  tables: Pick<DiningTable, 'id' | 'name'>[]
}

export function ViewerScreen({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [tab, setTab] = useState<'historique' | 'podiums'>('podiums')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(REFRESH_SECONDS)
  const [cycle, setCycle] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)

  const load = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    setLoading(true)
    try {
      const [tickets, profiles, tables] = await Promise.all([
        fetchAll<TicketWithItems>((from, to) =>
          sb()
            .from('tickets')
            .select('*, ticket_items(*)')
            .neq('status', 'brouillon')
            .order('sent_at', { ascending: false })
            .range(from, to),
        ),
        sb().from('profiles').select('id, display_name, role'),
        sb().from('tables').select('id, name'),
      ])
      setData({
        tickets,
        profiles: must(profiles) as Data['profiles'],
        tables: must(tables) as Data['tables'],
      })
      setError(null)
      setUpdatedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      pending.current = false
      setLoading(false)
    }
  }, [])

  // ---------- chrono : rechargement toutes les 5 s ----------
  useEffect(() => {
    let n = REFRESH_SECONDS
    const first = setTimeout(load, 0)
    const id = setInterval(() => {
      n -= 1
      if (n <= 0) {
        n = REFRESH_SECONDS
        setCycle((c) => c + 1)
        void load()
      }
      setLeft(n)
    }, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [load])

  const lk = useMemo<Lookup | null>(() => {
    if (!data) return null
    const w = new Map(data.profiles.map((p) => [p.id, p.display_name]))
    const t = new Map(data.tables.map((x) => [x.id, x.name]))
    return { waiterName: (id) => w.get(id) ?? '?', tableName: (id) => t.get(id) ?? '?' }
  }, [data])

  const d = useMemo(() => (data && lk ? computeDecompte(data.tickets, lk) : null), [data, lk])

  async function signOut() {
    await sb().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---------- bandeau ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <span className="text-xl font-black tracking-tight">Tablo · Ventes</span>
          <RefreshTimer left={left} loading={loading} updatedAt={updatedAt} error={!!error} />
          {profile.role === 'admin' ? (
            <Link href="/" className="btn btn-sm btn-ghost ml-auto">
              Quitter
            </Link>
          ) : (
            <button className="btn btn-sm btn-ghost ml-auto" onClick={signOut}>
              Déconnexion
            </button>
          )}
        </div>
        {/* barre de progression du chrono */}
        <div className="h-1 bg-surface">
          <div key={cycle} className="animate-refill h-full bg-accent" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && <div className="card border-red-500 p-3 text-sm text-red-200">Erreur : {error} — nouvel essai dans {left} s</div>}

        {!d || !lk ? (
          !error && <p className="p-8 text-center text-muted">Chargement…</p>
        ) : (
          <>
            {/* ---------- chiffres clés ---------- */}
            <section className="card grid grid-cols-3 divide-x divide-line text-center">
              <Kpi label="Chiffre d'affaires" value={formatPrice(d.total.cents)} />
              <Kpi label="Tickets" value={String(d.total.tickets)} />
              <Kpi label="Articles" value={String(d.total.items)} />
            </section>

            {/* ---------- onglets ---------- */}
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn ${tab === 'podiums' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('podiums')}>
                🏆 Podiums
              </button>
              <button className={`btn ${tab === 'historique' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('historique')}>
                🧾 Historique
              </button>
            </div>

            {tab === 'podiums' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Podium
                  title="Meilleurs produits"
                  icon="🍹"
                  rows={[...d.byProduct].sort((a, b) => b.items - a.items || b.cents - a.cents)}
                  value={(r) => `${r.items} vendus`}
                  sub={(r) => formatPrice(r.cents)}
                />
                <Podium
                  title="Meilleurs serveurs"
                  icon="🧑‍🍳"
                  rows={d.byWaiter}
                  value={(r) => formatPrice(r.cents)}
                  sub={(r) => `${r.tickets} tickets · ${r.items} art.`}
                />
                <Podium
                  title="Meilleures tables"
                  icon="🪑"
                  rows={d.byTable}
                  value={(r) => formatPrice(r.cents)}
                  sub={(r) => `${r.tickets} tickets · ${r.items} art.`}
                />
              </div>
            ) : (
              <History tickets={data!.tickets} profiles={data!.profiles} lk={lk} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

/* ============================== CHRONO ============================== */

function RefreshTimer({ left, loading, updatedAt, error }: { left: number; loading: boolean; updatedAt: number | null; error: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${error ? 'animate-pulse bg-red-500' : loading ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
      <span className="font-bold tabular-nums">{loading ? '…' : `${left} s`}</span>
      {updatedAt && (
        <span className="hidden text-xs text-muted sm:inline">
          màj {new Date(updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <div className="text-xl font-black sm:text-3xl">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

/* ============================== PODIUM ============================== */

const PLACES = [
  { medal: '🥇', block: 'h-32 bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950', ring: 'border-amber-300' },
  { medal: '🥈', block: 'h-24 bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900', ring: 'border-slate-300' },
  { medal: '🥉', block: 'h-16 bg-gradient-to-b from-orange-400 to-orange-700 text-orange-950', ring: 'border-orange-500' },
]

function Podium({
  title,
  icon,
  rows,
  value,
  sub,
}: {
  title: string
  icon: string
  rows: Agg[]
  value: (r: Agg) => string
  sub: (r: Agg) => string
}) {
  const top = rows.slice(0, 3)
  const rest = rows.slice(3, 8)
  // ordre d'affichage classique : 2e à gauche, 1er au centre, 3e à droite
  const order = [1, 0, 2]

  return (
    <section className="card p-4">
      <h2 className="mb-4 text-lg font-bold">
        {icon} {title}
      </h2>
      {top.length === 0 ? (
        <p className="py-10 text-center text-muted">Pas encore de ventes</p>
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-2">
            {order.map((place) => {
              const r = top[place]
              const p = PLACES[place]
              return (
                <div key={place} className="flex min-w-0 flex-col items-center">
                  {r ? (
                    <div className="mb-2 w-full min-w-0 text-center">
                      <div className="text-3xl leading-none">{p.medal}</div>
                      <div className="mt-1 truncate font-bold" title={r.label}>
                        {r.label}
                      </div>
                      <div className="text-sm font-semibold">{value(r)}</div>
                      <div className="truncate text-xs text-muted">{sub(r)}</div>
                    </div>
                  ) : (
                    <div className="mb-2 text-sm text-muted">—</div>
                  )}
                  {/* marche du podium */}
                  <div
                    className={`flex w-full items-start justify-center rounded-t-lg border-x-2 border-t-2 pt-1 text-4xl font-black shadow-inner ${p.block} ${p.ring} ${
                      r ? '' : 'opacity-30'
                    }`}
                  >
                    {place + 1}
                  </div>
                </div>
              )
            })}
          </div>
          {/* socle */}
          <div className="h-2 rounded-b-md bg-line" />

          {rest.length > 0 && (
            <ol className="mt-4 space-y-1 text-sm">
              {rest.map((r, i) => (
                <li key={r.key} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                  <span className="w-6 font-bold text-muted">{i + 4}</span>
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="font-semibold">{value(r)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}

/* ============================== HISTORIQUE ============================== */

function History({
  tickets,
  profiles,
  lk,
}: {
  tickets: TicketWithItems[]
  profiles: Data['profiles']
  lk: Lookup
}) {
  const [waiterId, setWaiterId] = useState('')
  const waiters = profiles.filter((p) => p.role === 'serveur' || p.role === 'admin')
  // plus récent en premier ; les tickets annulés ne sont pas des ventes
  const list = tickets.filter((t) => isCounted(t.status) && (!waiterId || t.waiter_id === waiterId))

  return (
    <section className="space-y-3">
      <select className="input" value={waiterId} onChange={(e) => setWaiterId(e.target.value)} aria-label="Serveur">
        <option value="">Tous les serveurs</option>
        {waiters.map((w) => (
          <option key={w.id} value={w.id}>
            {w.display_name}
          </option>
        ))}
      </select>

      {list.length === 0 && <p className="card p-6 text-center text-muted">Aucune vente pour l&apos;instant.</p>}

      <ul className="space-y-2">
        {list.map((t) => {
          const items = [...t.ticket_items].sort((a, b) => a.position - b.position)
          return (
            <li key={t.id} className="card p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold tabular-nums">{formatTime(t.sent_at)}</span>
                <span className="font-semibold">🧑‍🍳 {lk.waiterName(t.waiter_id)}</span>
                <span className="text-muted">→</span>
                <span className="font-semibold">🪑 {lk.tableName(t.table_id)}</span>
                <span className="text-xs text-muted">#{t.number}</span>
                <StatusChip status={t.status} />
                <span className="ml-auto font-bold">{formatPrice(itemsTotal(items))}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex gap-2">
                    <span className="font-bold">{i.quantity}×</span>
                    <span className="flex-1">
                      {i.product_name}
                      {i.note && <span className="ml-1 text-xs text-amber-300">({i.note})</span>}
                    </span>
                    <span className="text-muted">{formatPrice(i.quantity * i.unit_price_cents)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-right text-xs text-muted">{itemsCount(items)} article(s)</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
