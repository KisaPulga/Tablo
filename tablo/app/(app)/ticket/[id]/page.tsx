'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useProfile } from '@/components/ProfileContext'
import { useToast } from '@/components/Toaster'
import { Loading, StatusChip } from '@/components/ui'
import { formatAgo, formatPrice, formatTime, itemsCount, itemsTotal } from '@/lib/format'
import { must, sb, useLive, useNow } from '@/lib/live'
import type { DiningTable, Product, TicketWithItems } from '@/lib/types'

type Line = {
  product_id: string
  product_name: string
  unit_price_cents: number
  quantity: number
  note: string
}

function linesFromTicket(t: TicketWithItems): Line[] {
  return [...t.ticket_items]
    .sort((a, b) => a.position - b.position)
    .filter((i) => i.product_id)
    .map((i) => ({
      product_id: i.product_id!,
      product_name: i.product_name,
      unit_price_cents: i.unit_price_cents,
      quantity: i.quantity,
      note: i.note ?? '',
    }))
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const me = useProfile()
  const toast = useToast()
  const now = useNow()

  const { data, error, reload } = useLive(
    async () => {
      const ticket = must(
        await sb().from('tickets').select('*, ticket_items(*)').eq('id', id).maybeSingle(),
      ) as TicketWithItems | null
      if (!ticket) return null
      const [table, waiter, products] = await Promise.all([
        sb().from('tables').select('*').eq('id', ticket.table_id).maybeSingle(),
        sb().from('profiles').select('display_name').eq('id', ticket.waiter_id).maybeSingle(),
        sb().from('products').select('*').order('sort_order').order('name'),
      ])
      return {
        ticket,
        table: must(table) as DiningTable | null,
        waiterName: (must(waiter) as { display_name: string } | null)?.display_name ?? '?',
        products: must(products) as Product[],
      }
    },
    { tables: ['tickets', 'ticket_items', 'products'], key: id },
  )

  // ---------- état local de saisie ----------
  const [lines, setLines] = useState<Line[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openNote, setOpenNote] = useState<string | null>(null)
  const linesRef = useRef(lines)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    linesRef.current = lines
    dirtyRef.current = dirty
  })

  const ticket = data?.ticket ?? null
  const isOwner = ticket?.waiter_id === me.id
  const isAdmin = me.role === 'admin'
  const editable = !!ticket && (isOwner || isAdmin) && (ticket.status === 'brouillon' || ticket.status === 'envoye')
  const isDraft = ticket?.status === 'brouillon'

  // synchronise depuis le serveur tant qu'il n'y a pas de saisie en cours
  // (ajustement pendant le rendu, cf. « You might not need an effect »)
  const [syncedTicket, setSyncedTicket] = useState<TicketWithItems | null>(null)
  if (ticket && ticket !== syncedTicket) {
    setSyncedTicket(ticket)
    const locked = ticket.status !== 'brouillon' && ticket.status !== 'envoye'
    if (!dirty || locked) {
      // ticket verrouillé (pris par le bar, servi, annulé) : on affiche la version serveur
      if (dirty) setDirty(false)
      setLines(linesFromTicket(ticket))
    }
  }

  const save = useCallback(
    async (send: boolean) => {
      setSaving(true)
      const payload = linesRef.current.map((l) => ({ product_id: l.product_id, quantity: l.quantity, note: l.note }))
      const savedLines = linesRef.current
      const ok = await toast.attempt(send ? 'Envoi au bar' : 'Enregistrement', async () => {
        must(await sb().rpc('save_ticket', { p_ticket_id: id, p_note: null, p_items: payload, p_send: send }))
      })
      setSaving(false)
      if (ok) {
        // si rien n'a changé pendant l'envoi, la saisie est à jour
        if (linesRef.current === savedLines) setDirty(false)
        reload()
      } else {
        reload()
      }
      return ok
    },
    [id, reload, toast],
  )

  // brouillon : enregistrement automatique
  useEffect(() => {
    if (!dirty || !isDraft) return
    const t = setTimeout(() => void save(false), 700)
    return () => clearTimeout(t)
  }, [dirty, isDraft, lines, save])

  // en quittant la page avec un brouillon non enregistré
  useEffect(() => {
    return () => {
      if (dirtyRef.current && isDraft) {
        const payload = linesRef.current.map((l) => ({ product_id: l.product_id, quantity: l.quantity, note: l.note }))
        void sb().rpc('save_ticket', { p_ticket_id: id, p_note: null, p_items: payload, p_send: false })
      }
    }
  }, [id, isDraft])

  if (data === null && !error) return <Loading />
  if (!data) return error ? <Loading error={error} /> : <p className="card p-4">Ticket introuvable.</p>
  if (!ticket) return <p className="card p-4">Ticket introuvable.</p>

  const { products, table, waiterName } = data

  function change(fn: (l: Line[]) => Line[]) {
    setLines((prev) => fn(prev))
    setDirty(true)
  }
  function add(p: Product) {
    navigator.vibrate?.(15)
    change((ls) => {
      const i = ls.findIndex((l) => l.product_id === p.id)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l))
      return [...ls, { product_id: p.id, product_name: p.name, unit_price_cents: p.price_cents, quantity: 1, note: '' }]
    })
  }
  function setQty(pid: string, delta: number) {
    change((ls) =>
      ls.map((l) => (l.product_id === pid ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0),
    )
  }
  function setLineNote(pid: string, value: string) {
    change((ls) => ls.map((l) => (l.product_id === pid ? { ...l, note: value } : l)))
  }

  async function setStatus(status: 'servi' | 'annule', label: string) {
    const ok = await toast.attempt(label, async () => {
      must(await sb().from('tickets').update({ status }).eq('id', id).select('id').single())
    })
    if (ok) {
      setDirty(false)
      toast.success(`${label} ✔`)
      reload()
    }
  }

  async function send() {
    if (lines.length === 0) return
    setDirty(false) // stoppe l'enregistrement automatique en attente
    const ok = await save(true)
    if (!ok) setDirty(true)
    if (ok) {
      toast.success('Envoyé au bar ✔')
      router.push(`/table/${ticket!.table_id}`)
    }
  }

  const total = itemsTotal(lines)
  const qtyByProduct = new Map(lines.map((l) => [l.product_id, l.quantity]))
  const available = products.filter((p) => p.is_available)

  const canServe = (isOwner || isAdmin) && ['envoye', 'en_preparation', 'pret'].includes(ticket.status)

  return (
    <div className="space-y-4">
      <Link href={`/table/${ticket.table_id}`} className="text-sm text-muted">
        ← {table?.name ?? 'Table'}
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">
          Ticket #{ticket.number} · {table?.name}
        </h1>
        <StatusChip status={ticket.status} />
      </div>
      <p className="-mt-2 text-sm text-muted">
        {waiterName} · créé à {formatTime(ticket.created_at)} ({formatAgo(ticket.created_at, now)})
        {!editable && !isOwner && !isAdmin && ' · lecture seule'}
      </p>

      {ticket.status === 'envoye' && editable && (
        <p className="rounded-xl border border-sky-400 bg-sky-950 p-3 text-sm">
          Déjà envoyé : tu peux encore modifier tant que le bar ne l&apos;a pas pris en charge. Le bar verra « modifié ».
        </p>
      )}

      {/* ---------- choix des produits ---------- */}
      {editable && (
        <section className="space-y-3">
          {available.length === 0 && <p className="card p-4 text-muted">Aucun produit disponible dans le menu.</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {available.map((p) => {
                  const q = qtyByProduct.get(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => add(p)}
                      className={`relative flex min-h-16 flex-col items-start justify-center rounded-xl border-2 border-white px-3 py-2 text-left active:scale-[0.96] ${
                        q ? 'bg-accent' : 'bg-surface'
                      }`}
                    >
                      <span className="leading-tight font-semibold">{p.name}</span>
                      <span className="text-sm text-white/75">{formatPrice(p.price_cents)}</span>
                      {q && (
                        <span className="absolute top-1 right-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-sm font-black text-background">
                          {q}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
        </section>
      )}

      {/* ---------- récapitulatif ---------- */}
      <section className="card divide-y divide-line">
        <h2 className="px-4 py-3 font-bold">
          Récapitulatif · {itemsCount(lines)} article{itemsCount(lines) > 1 ? 's' : ''}
        </h2>
        {lines.length === 0 && <p className="px-4 py-3 text-muted">Touchez un produit pour l&apos;ajouter.</p>}
        {lines.map((l) => (
          <div key={l.product_id} className="px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="font-semibold">{l.product_name}</div>
                <div className="text-xs text-muted">
                  {l.quantity} × {formatPrice(l.unit_price_cents)} = {formatPrice(l.quantity * l.unit_price_cents)}
                </div>
              </div>
              {editable ? (
                <>
                  <button
                    className="btn btn-sm btn-ghost"
                    aria-label="Note"
                    onClick={() => setOpenNote(openNote === l.product_id ? null : l.product_id)}
                  >
                    📝
                  </button>
                  <button className="btn h-11 w-11 p-0 text-xl" onClick={() => setQty(l.product_id, -1)} aria-label="Retirer">
                    −
                  </button>
                  <span className="w-7 text-center text-lg font-bold">{l.quantity}</span>
                  <button className="btn h-11 w-11 p-0 text-xl" onClick={() => setQty(l.product_id, 1)} aria-label="Ajouter">
                    +
                  </button>
                </>
              ) : (
                <span className="text-lg font-bold">×{l.quantity}</span>
              )}
            </div>
            {editable && openNote === l.product_id ? (
              <div className="mt-2 flex gap-2">
                {[
                  { label: 'Rien', value: '' },
                  { label: 'Tempéré', value: 'Tempéré' },
                ].map((o) => (
                  <button
                    key={o.label}
                    className={`btn btn-sm flex-1 ${l.note === o.value ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      setLineNote(l.product_id, o.value)
                      setOpenNote(null)
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              l.note && <div className="mt-1 text-sm text-amber-300">— {l.note}</div>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 text-xl font-bold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </section>

      {/* ---------- suivi ---------- */}
      <section className="card grid grid-cols-2 gap-x-4 gap-y-1 p-4 text-sm sm:grid-cols-5">
        <Step label="Créé" at={ticket.created_at} />
        <Step label="Envoyé" at={ticket.sent_at} />
        <Step label="En prépa" at={ticket.preparing_at} />
        <Step label="Prêt" at={ticket.ready_at} />
        <Step label={ticket.status === 'annule' ? 'Annulé' : 'Servi'} at={ticket.status === 'annule' ? ticket.cancelled_at : ticket.served_at} />
      </section>

      {/* ---------- actions ---------- */}
      <div className="flex flex-wrap gap-2">
        {canServe && (
          <button className="btn btn-success flex-1" onClick={() => setStatus('servi', 'Ticket servi')}>
            ✔ Marquer servi
          </button>
        )}
      </div>

      {/* barre d'action collante */}
      {editable && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 px-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border-2 border-white bg-surface-2 p-2 pl-4 shadow-2xl">
            <div className="flex-1 leading-tight">
              <div className="text-xl font-bold">{formatPrice(total)}</div>
              <div className="text-xs text-muted">
                {saving ? 'Enregistrement…' : dirty ? (isDraft ? 'Modifications…' : 'Non enregistré') : 'Enregistré'}
              </div>
            </div>
            {isDraft ? (
              <button className="btn btn-primary px-6 py-3 text-lg" disabled={lines.length === 0 || saving} onClick={send}>
                Envoyer au bar
              </button>
            ) : (
              <button className="btn btn-primary px-6 py-3" disabled={!dirty || saving} onClick={() => void save(false)}>
                Enregistrer
              </button>
            )}
          </div>
        </div>
      )}
      {editable && <div className="h-20" />}
    </div>
  )
}

function Step({ label, at }: { label: string; at: string | null }) {
  return (
    <div className={at ? '' : 'text-muted/60'}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold">{formatTime(at)}</div>
    </div>
  )
}
