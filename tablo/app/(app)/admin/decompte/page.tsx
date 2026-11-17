'use client'

import { useMemo, useState } from 'react'
import { BarList, TimeChart } from '@/components/Charts'
import { useToast } from '@/components/Toaster'
import { Loading } from '@/components/ui'
import { csvEuros, downloadCsv, formatDuration, formatPrice, formatTime, itemsCount, itemsTotal } from '@/lib/format'
import { fetchAll, must, sb, useLive } from '@/lib/live'
import { computeDecompte, computeStats, type Lookup, type StatsFilters } from '@/lib/stats'
import {
  STATUS_LABEL,
  type DiningTable,
  type Profile,
  type TicketWithItems,
} from '@/lib/types'

export default function DecomptePage() {
  const [tab, setTab] = useState<'decompte' | 'stats'>('decompte')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, error } = useLive(
    async () => {
      const [tickets, profiles, tables] = await Promise.all([
        fetchAll<TicketWithItems>((from, to) =>
          sb()
            .from('tickets')
            .select('*, ticket_items(*)')
            .neq('status', 'brouillon')
            .order('sent_at')
            .range(from, to),
        ),
        sb().from('profiles').select('id, display_name, role'),
        sb().from('tables').select('*'),
      ])
      return {
        tickets,
        profiles: must(profiles) as Profile[],
        tables: must(tables) as DiningTable[],
      }
    },
    { tables: ['tickets', 'ticket_items'], fallbackMs: 15000 },
  )

  const lk = useMemo<Lookup | null>(() => {
    if (!data) return null
    const w = new Map(data.profiles.map((p) => [p.id, p.display_name]))
    const t = new Map(data.tables.map((x) => [x.id, x.name]))
    return {
      waiterName: (id) => w.get(id) ?? '?',
      tableName: (id) => t.get(id) ?? '?',
    }
  }, [data])

  if (!data || !lk) return <Loading error={error} />

  const fromTs = from ? new Date(from).getTime() : null
  const toTs = to ? new Date(to).getTime() : null
  // un ticket appartient à la période selon l'heure d'envoi au bar
  const inPeriod = data.tickets.filter((t) => {
    if (fromTs == null && toTs == null) return true
    if (!t.sent_at) return false
    const ts = new Date(t.sent_at).getTime()
    return (fromTs == null || ts >= fromTs) && (toTs == null || ts <= toTs)
  })
  const periodLabel = from || to ? `${from ? fmtInput(from) : 'début'} → ${to ? fmtInput(to) : 'fin'}` : 'toute la base'

  return (
    <div className="space-y-4">
      <PeriodBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="grid grid-cols-2 gap-2">
        <button className={`btn ${tab === 'decompte' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('decompte')}>
          Décompte
        </button>
        <button className={`btn ${tab === 'stats' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('stats')}>
          Statistiques
        </button>
      </div>
      {tab === 'decompte' ? (
        <Decompte tickets={inPeriod} lk={lk} periodLabel={periodLabel} />
      ) : (
        <Stats data={data} lk={lk} fromTs={fromTs} toTs={toTs} periodLabel={periodLabel} />
      )}
    </div>
  )
}

/* ============================== DÉCOMPTE ============================== */

function Decompte({ tickets, lk, periodLabel }: { tickets: TicketWithItems[]; lk: Lookup; periodLabel: string }) {
  const d = useMemo(() => computeDecompte(tickets, lk), [tickets, lk])
  const [openWaiter, setOpenWaiter] = useState<string | null>(null)
  const [openTable, setOpenTable] = useState<string | null>(null)

  function exportLines() {
    const rows: (string | number)[][] = [
      ['Ticket', 'Envoyé à', 'Statut', 'Table', 'Serveur', 'Produit', 'Quantité', 'Prix unitaire', 'Total ligne'],
    ]
    for (const t of tickets)
      for (const i of t.ticket_items)
        rows.push([
          t.number,
          t.sent_at ? new Date(t.sent_at).toLocaleString('fr-FR') : '',
          STATUS_LABEL[t.status],
          lk.tableName(t.table_id),
          lk.waiterName(t.waiter_id),
          i.product_name,
          i.quantity,
          csvEuros(i.unit_price_cents),
          csvEuros(i.quantity * i.unit_price_cents),
        ])
    downloadCsv(`tablo-lignes${fileSuffix(periodLabel)}.csv`, rows)
  }

  function exportSummary() {
    const rows: (string | number)[][] = [
      ['DÉCOMPTE', `Période : ${periodLabel}`],
      [],
      ['TOTAL GÉNÉRAL'],
      ['Tickets', 'Articles', 'CA (€)'],
      [d.total.tickets, d.total.items, csvEuros(d.total.cents)],
      [],
      ['PAR SERVEUR'],
      ['Serveur', 'Tickets', 'Articles', 'CA (€)'],
      ...d.byWaiter.map((w) => [w.label, w.tickets, w.items, csvEuros(w.cents)]),
      [],
      ['PAR PRODUIT'],
      ['Produit', 'Quantité', 'CA (€)'],
      ...d.byProduct.map((p) => [p.label, p.items, csvEuros(p.cents)]),
      [],
      ['DÉTAIL SERVEUR × PRODUIT'],
      ['Serveur', 'Produit', 'Quantité', 'CA (€)'],
      ...d.byWaiter.flatMap((w) => (d.cross.get(w.key) ?? []).map((p) => [w.label, p.label, p.items, csvEuros(p.cents)])),
      [],
      ['PAR TABLE'],
      ['Table', 'Tickets', 'Articles', 'CA (€)'],
      ...d.byTable.map((t) => [t.label, t.tickets, t.items, csvEuros(t.cents)]),
    ]
    downloadCsv(`tablo-decompte${fileSuffix(periodLabel)}.csv`, rows)
  }

  return (
    <div className="space-y-6">
      <section className="card grid grid-cols-3 divide-x divide-line text-center">
        <Kpi label="Chiffre d'affaires" value={formatPrice(d.total.cents)} big />
        <Kpi label="Tickets" value={String(d.total.tickets)} />
        <Kpi label="Articles" value={String(d.total.items)} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={exportSummary}>
          ⬇ CSV récapitulatif
        </button>
        <button className="btn btn-sm" onClick={exportLines}>
          ⬇ CSV toutes les lignes
        </button>
      </div>

      <Section title="Par serveur">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1">Serveur</th>
              <th className="text-right">Tickets</th>
              <th className="text-right">Articles</th>
              <th className="text-right">CA</th>
            </tr>
          </thead>
          <tbody>
            {d.byWaiter.map((w) => (
              <WaiterRows
                key={w.key}
                w={w}
                products={d.cross.get(w.key) ?? []}
                open={openWaiter === w.key}
                toggle={() => setOpenWaiter(openWaiter === w.key ? null : w.key)}
              />
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Touchez un serveur pour voir le détail par produit.</p>
      </Section>

      <Section title="Par produit">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1">Produit</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">CA</th>
            </tr>
          </thead>
          <tbody>
            {d.byProduct.map((p) => (
              <tr key={p.key} className="border-t border-line">
                <td className="py-1.5">{p.label}</td>
                <td className="text-right tabular-nums">{p.items}</td>
                <td className="text-right tabular-nums">{formatPrice(p.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Par table">
        <ul className="divide-y divide-line">
          {d.byTable.map((t) => (
            <li key={t.key} className="py-1">
              <button className="flex w-full items-center justify-between py-1.5 text-left" onClick={() => setOpenTable(openTable === t.key ? null : t.key)}>
                <span className="font-semibold">
                  {openTable === t.key ? '▾' : '▸'} {t.label}{' '}
                  <span className="text-xs font-normal text-muted">
                    {t.tickets} ticket{t.tickets > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{formatPrice(t.cents)}</span>
              </button>
              {openTable === t.key && (
                <ul className="mb-2 space-y-1 pl-4 text-sm">
                  {(d.tableTickets.get(t.key) ?? []).map((tk) => (
                    <li key={tk.id} className="flex justify-between gap-2 text-muted">
                      <span>
                        #{tk.number} · {formatTime(tk.sent_at)} · {lk.waiterName(tk.waiter_id)} ·{' '}
                        {tk.ticket_items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatPrice(itemsTotal(tk.ticket_items))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function WaiterRows({
  w,
  products,
  open,
  toggle,
}: {
  w: { key: string; label: string; tickets: number; items: number; cents: number }
  products: { key: string; label: string; items: number; cents: number }[]
  open: boolean
  toggle: () => void
}) {
  return (
    <>
      <tr className="cursor-pointer border-t border-line" onClick={toggle}>
        <td className="py-2 font-semibold">
          {open ? '▾' : '▸'} {w.label}
        </td>
        <td className="text-right tabular-nums">{w.tickets}</td>
        <td className="text-right tabular-nums">{w.items}</td>
        <td className="text-right font-bold tabular-nums">{formatPrice(w.cents)}</td>
      </tr>
      {open &&
        products.map((p) => (
          <tr key={p.key} className="text-muted">
            <td className="py-0.5 pl-6">{p.label}</td>
            <td />
            <td className="text-right tabular-nums">{p.items}</td>
            <td className="text-right tabular-nums">{formatPrice(p.cents)}</td>
          </tr>
        ))}
    </>
  )
}

/* ============================== STATISTIQUES ============================== */

function Stats({
  data,
  lk,
  fromTs,
  toTs,
  periodLabel,
}: {
  data: { tickets: TicketWithItems[]; profiles: Profile[] }
  lk: Lookup
  fromTs: number | null
  toTs: number | null
  periodLabel: string
}) {
  const [waiterId, setWaiterId] = useState('')
  const [bucket, setBucket] = useState<15 | 60>(15)
  const [metric, setMetric] = useState<'cents' | 'items'>('cents')
  const [productSort, setProductSort] = useState<'cents' | 'items'>('items')

  const filters: StatsFilters = {
    from: fromTs,
    to: toTs,
    waiterId,
    bucketMinutes: bucket,
  }
  const s = useMemo(
    () => computeStats(data.tickets, lk, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tickets, lk, fromTs, toTs, waiterId, bucket],
  )

  const waiters = data.profiles.filter((p) => p.role !== 'bar')

  const fmtMetric = metric === 'cents' ? formatPrice : (v: number) => `${v} art.`
  const pct = (x: number) => `${Math.round(x * 100)} %`

  function exportStats() {
    const rows: (string | number)[][] = [
      ['STATISTIQUES', `Période : ${periodLabel}`, `Serveur : ${waiterId ? lk.waiterName(waiterId) : 'tous'}`],
      [],
      ['Indicateur', 'Valeur'],
      ['CA (€)', csvEuros(s.totalCents)],
      ['Tickets', s.nTickets],
      ['Articles', s.totalItems],
      ['Panier moyen (€)', csvEuros(Math.round(s.avgBasket))],
      ['Articles par ticket', s.avgItems.toFixed(2).replace('.', ',')],
      ['Taux d’annulation', pct(s.cancelRate)],
      [],
      [`VENTES PAR TRANCHE DE ${bucket} MIN`],
      ['Début', 'Articles', 'CA (€)'],
      ...s.timeline.map((b) => [new Date(b.start).toLocaleString('fr-FR'), b.items, csvEuros(b.cents)]),
      [],
      ['PRODUITS'],
      ['Produit', 'Quantité', 'CA (€)', 'Part CA'],
      ...[...s.products].sort((a, b) => b.cents - a.cents).map((p) => [p.label, p.items, csvEuros(p.cents), s.totalCents ? pct(p.cents / s.totalCents) : '']),
      [],
      ['SERVEURS'],
      ['Serveur', 'CA (€)', 'Tickets', 'Articles', 'Panier moyen (€)'],
      ...s.waiters.map((w) => [w.label, csvEuros(w.cents), w.tickets, w.items, csvEuros(w.tickets ? Math.round(w.cents / w.tickets) : 0)]),
      [],
      ['TABLES'],
      ['Table', 'CA (€)', 'Tickets', 'Articles'],
      ...s.tables.map((t) => [t.label, csvEuros(t.cents), t.tickets, t.items]),
      [],
      ['TEMPS DE SERVICE (secondes)'],
      ['Serveur', 'Envoyé → en préparation', 'Envoyé → prêt', 'Prêt → servi'],
      ['Global', ...[s.serviceGlobal.toPrep, s.serviceGlobal.toReady, s.serviceGlobal.toServed].map((x) => (x == null ? '' : Math.round(x / 1000)))],
      ...s.serviceByWaiter.map((w) => [w.name, ...[w.toPrep, w.toReady, w.toServed].map((x) => (x == null ? '' : Math.round(x / 1000)))]),
      [],
      ['ANNULATIONS'],
      ['Serveur', 'Tickets envoyés', 'Annulés', 'Taux'],
      ...s.cancelByWaiter.map((c) => [c.name, c.sent, c.cancelled, pct(c.rate)]),
    ]
    downloadCsv(`tablo-statistiques${fileSuffix(periodLabel)}.csv`, rows)
  }

  return (
    <div className="space-y-6">
      {/* ---------- filtres ---------- */}
      <section className="card grid grid-cols-2 gap-2 p-3">
        <select className="input col-span-2" value={waiterId} onChange={(e) => setWaiterId(e.target.value)} aria-label="Serveur">
          <option value="">Tous les serveurs</option>
          {waiters.map((w) => (
            <option key={w.id} value={w.id}>
              {w.display_name}
            </option>
          ))}
        </select>
        <div className="col-span-2 flex flex-wrap gap-2">
          {waiterId && (
            <button className="btn btn-sm btn-ghost" onClick={() => setWaiterId('')}>
              Tous les serveurs
            </button>
          )}
          <button className="btn btn-sm ml-auto" onClick={exportStats}>
            ⬇ CSV statistiques
          </button>
        </div>
      </section>

      {/* ---------- indicateurs ---------- */}
      <section className="card grid grid-cols-2 divide-line text-center sm:grid-cols-4 sm:divide-x">
        <Kpi label="Chiffre d'affaires" value={formatPrice(s.totalCents)} big />
        <Kpi label="Panier moyen" value={formatPrice(Math.round(s.avgBasket))} />
        <Kpi label="Articles / ticket" value={s.avgItems.toFixed(1).replace('.', ',')} />
        <Kpi label="Taux d'annulation" value={pct(s.cancelRate)} sub={`${s.cancelledTotal} / ${s.sentTotal}`} />
      </section>

      {/* ---------- ventes dans le temps ---------- */}
      <Section
        title="Ventes dans le temps"
        right={
          <div className="flex gap-1">
            <Toggle on={metric === 'cents'} onClick={() => setMetric('cents')}>€</Toggle>
            <Toggle on={metric === 'items'} onClick={() => setMetric('items')}>Qté</Toggle>
            <Toggle on={bucket === 15} onClick={() => setBucket(15)}>15 min</Toggle>
            <Toggle on={bucket === 60} onClick={() => setBucket(60)}>1 h</Toggle>
          </div>
        }
      >
        <TimeChart
          label={metric === 'cents' ? `CA par tranche de ${bucket} min` : `Articles par tranche de ${bucket} min`}
          format={fmtMetric}
          points={s.timeline.map((b) => ({
            start: b.start,
            value: metric === 'cents' ? b.cents : b.items,
            detail: metric === 'cents' ? `${b.items} art.` : formatPrice(b.cents),
          }))}
        />
      </Section>

      {/* ---------- produits ---------- */}
      <Section
        title="Top produits"
        right={
          <div className="flex gap-1">
            <Toggle on={productSort === 'items'} onClick={() => setProductSort('items')}>Qté</Toggle>
            <Toggle on={productSort === 'cents'} onClick={() => setProductSort('cents')}>€</Toggle>
          </div>
        }
      >
        <BarList
          share
          format={productSort === 'cents' ? formatPrice : (v) => `${v}`}
          rows={[...s.products]
            .sort((a, b) => (productSort === 'cents' ? b.cents - a.cents : b.items - a.items))
            .slice(0, 15)
            .map((p) => ({
              key: p.key,
              label: p.label,
              value: productSort === 'cents' ? p.cents : p.items,
              sub: productSort === 'cents' ? `${p.items} vendus` : formatPrice(p.cents),
            }))}
        />
      </Section>

      {/* ---------- serveurs ---------- */}
      <Section title="Classement des serveurs">
        <BarList
          format={formatPrice}
          rows={s.waiters.map((w) => ({
            key: w.key,
            label: w.label,
            value: w.cents,
            sub: `${w.tickets} tickets · ${w.items} articles · panier moyen ${formatPrice(w.tickets ? Math.round(w.cents / w.tickets) : 0)}`,
          }))}
        />
      </Section>

      <Section title="Ventes par table">
        <BarList
          format={formatPrice}
          rows={s.tables.map((t) => ({ key: t.key, label: t.label, value: t.cents, sub: `${t.tickets} tickets · ${t.items} articles` }))}
        />
      </Section>

      {/* ---------- temps de service ---------- */}
      <Section title="Temps de service (moyennes)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1"></th>
                <th className="text-right">Envoyé → prépa</th>
                <th className="text-right">Envoyé → prêt</th>
                <th className="text-right">Prêt → servi</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line font-bold">
                <td className="py-1.5">Global</td>
                <td className="text-right">{formatDuration(s.serviceGlobal.toPrep)}</td>
                <td className="text-right">{formatDuration(s.serviceGlobal.toReady)}</td>
                <td className="text-right">{formatDuration(s.serviceGlobal.toServed)}</td>
              </tr>
              {s.serviceByWaiter.map((w) => (
                <tr key={w.id} className="border-t border-line">
                  <td className="py-1.5">{w.name}</td>
                  <td className="text-right">{formatDuration(w.toPrep)}</td>
                  <td className="text-right">{formatDuration(w.toReady)}</td>
                  <td className="text-right">{formatDuration(w.toServed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.longest && (
          <p className="mt-3 text-sm">
            <span className="text-muted">Ticket le plus long :</span> #{s.longest.ticket.number} ·{' '}
            {lk.tableName(s.longest.ticket.table_id)} · {lk.waiterName(s.longest.ticket.waiter_id)} ·{' '}
            <b>{formatDuration(s.longest.ms)}</b> ({itemsCount(s.longest.ticket.ticket_items)} articles)
          </p>
        )}
      </Section>

      {/* ---------- annulations ---------- */}
      <Section title="Annulations par serveur">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1">Serveur</th>
              <th className="text-right">Envoyés</th>
              <th className="text-right">Annulés</th>
              <th className="text-right">Taux</th>
            </tr>
          </thead>
          <tbody>
            {s.cancelByWaiter.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-1.5">{c.name}</td>
                <td className="text-right">{c.sent}</td>
                <td className="text-right">{c.cancelled}</td>
                <td className="text-right font-bold">{pct(c.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <DeleteAllTickets />
    </div>
  )
}

/* ============================== SUPPRESSION ============================== */

/** Supprime TOUS les tickets (et leurs lignes, en cascade), après une grosse confirmation */
function DeleteAllTickets() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    setBusy(true)
    let count = 0
    const ok = await toast.attempt('Suppression des tickets', async () => {
      // fonction SQL réservée à l'admin ; renvoie le nombre de tickets supprimés
      count = (must(await sb().rpc('delete_all_tickets')) as number) ?? 0
    })
    setBusy(false)
    if (ok) {
      setOpen(false)
      toast.success(`${count} ticket${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}`)
    }
  }

  return (
    <>
      <div className="pt-6">
        <button className="btn btn-danger w-full py-4 text-lg" onClick={() => setOpen(true)}>
          Supprimer les tickets
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md space-y-5 rounded-3xl border-4 border-red-500 bg-background p-6 text-center shadow-2xl">
            <div className="text-6xl">⚠️</div>
            <h2 id="delete-all-title" className="text-3xl font-black text-red-300">
              Supprimer tous les tickets ?
            </h2>
            <p className="text-lg">
              <b>Tous les tickets de toutes les soirées</b> seront effacés définitivement, avec leur contenu. Le décompte
              et les statistiques repartiront à zéro.
            </p>
            <p className="text-sm text-muted">
              Cette action est irréversible. Pense à exporter les CSV avant si tu veux garder une trace.
            </p>
            <div className="flex flex-col gap-3">
              <button className="btn btn-danger w-full py-4 text-lg" disabled={busy} onClick={confirmDelete}>
                {busy ? 'Suppression…' : 'Oui, tout supprimer'}
              </button>
              <button className="btn w-full py-3" disabled={busy} onClick={() => setOpen(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ============================== PÉRIODE ============================== */

/** Date → valeur d'un <input type="datetime-local"> (heure locale) */
function toLocalInput(d: Date) {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}

function fmtInput(v: string) {
  return new Date(v).toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fileSuffix(periodLabel: string) {
  if (periodLabel === 'toute la base') return ''
  return '-' + periodLabel.normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** Vendredi de l'événement : vendredi 20 novembre 2026 (mois 10 = novembre, comptés à partir de 0) */
const EVENT_FRIDAY = new Date(2026, 10, 20)

function at(base: Date, addDays: number, hour: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, hour, 0)
}

function PeriodBar({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
}) {
  const fri = EVENT_FRIDAY
  const presets = [
    // vendredi : toute la journée jusqu'au samedi 4 h
    { label: 'Ven.', day: at(fri, 0, 0), from: toLocalInput(at(fri, 0, 0)), to: toLocalInput(at(fri, 1, 4)) },
    // samedi : 18 h jusqu'au dimanche 4 h
    { label: 'Sam.', day: at(fri, 1, 0), from: toLocalInput(at(fri, 1, 18)), to: toLocalInput(at(fri, 2, 4)) },
  ]
  const set = (f: string, t: string) => {
    setFrom(f)
    setTo(t)
  }

  return (
    <section className="card space-y-2 p-3">
      {/* toujours sur une seule ligne, même sur petit écran */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-sm font-bold">Période</span>
        <button
          className={`btn btn-sm min-w-0 flex-1 px-2 whitespace-nowrap ${!from && !to ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => set('', '')}
        >
          Tout
        </button>
        {presets.map((p) => (
          <button
            key={p.label}
            className={`btn btn-sm min-w-0 flex-[1.6] px-2 whitespace-nowrap ${
              from === p.from && to === p.to ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={() => set(p.from, p.to)}
          >
            {p.label} {p.day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <span className="w-14 shrink-0">Depuis</span>
          <input type="datetime-local" className="input input-date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <span className="w-14 shrink-0">Jusqu&apos;à</span>
          <input type="datetime-local" className="input input-date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
    </section>
  )
}

/* ============================== UI ============================== */

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-bold tabular-nums ${big ? 'text-2xl' : 'text-xl'}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`btn btn-sm px-2 ${on ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick}>
      {children}
    </button>
  )
}
