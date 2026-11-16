'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/Toaster'
import { ConnectionDot } from '@/components/ui'
import { minutesSince } from '@/lib/format'
import { must, sb, useLive, useNow } from '@/lib/live'
import { SOUND_MODIFIED, SOUND_NEW, beep, unlockAudio } from '@/lib/sound'
import type { DiningTable, Profile, TicketStatus, TicketWithItems } from '@/lib/types'

const LATE_MINUTES = 5

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void }

export function BarScreen({ profile }: { profile: Profile }) {
  const toast = useToast()
  const router = useRouter()
  const now = useNow(10000)
  const [started, setStarted] = useState(false)
  const [wakeOk, setWakeOk] = useState(false)
  const [flash, setFlash] = useState(0)
  const [highlight, setHighlight] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const { data, error, connected, reload } = useLive(
    async () => {
      const [tickets, tables, profiles] = await Promise.all([
        sb()
          .from('tickets')
          .select('*, ticket_items(*)')
          .in('status', ['envoye', 'en_preparation', 'pret'])
          .order('sent_at', { ascending: true }),
        sb().from('tables').select('id, name'),
        sb().from('profiles').select('id, display_name'),
      ])
      return {
        tickets: must(tickets) as TicketWithItems[],
        tables: must(tables) as Pick<DiningTable, 'id' | 'name'>[],
        profiles: must(profiles) as Pick<Profile, 'id' | 'display_name'>[],
      }
    },
    { tables: ['tickets', 'ticket_items', 'tables'], fallbackMs: 5000 },
  )

  // ---------- détection des nouveaux tickets / modifications ----------
  const known = useRef<Map<string, string | null> | null>(null)
  useEffect(() => {
    if (!data) return
    const incoming = data.tickets.filter((t) => t.status === 'envoye' || t.status === 'en_preparation')
    const next = new Map(incoming.map((t) => [t.id, t.modified_at]))
    if (known.current) {
      const fresh = incoming.filter((t) => !known.current!.has(t.id))
      const modified = incoming.filter((t) => known.current!.has(t.id) && known.current!.get(t.id) !== t.modified_at)
      if (fresh.length) beep(SOUND_NEW, 0.6)
      else if (modified.length) beep(SOUND_MODIFIED, 0.5)
      if (fresh.length || modified.length) {
        setFlash((f) => f + 1)
        const ids = [...fresh, ...modified].map((t) => t.id)
        setHighlight((h) => new Set([...h, ...ids]))
        setTimeout(() => setHighlight((h) => new Set([...h].filter((x) => !ids.includes(x)))), 4000)
      }
    }
    known.current = next
  }, [data])

  // ---------- écran toujours allumé ----------
  useEffect(() => {
    if (!started) return
    let lock: WakeLockSentinelLike | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }
    const acquire = async () => {
      if (!nav.wakeLock || document.visibilityState !== 'visible') return
      try {
        lock = await nav.wakeLock.request('screen')
        setWakeOk(true)
        lock.addEventListener('release', () => setWakeOk(false))
      } catch {
        setWakeOk(false)
      }
    }
    acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        acquire()
        void unlockAudio()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [started])

  async function start() {
    await unlockAudio()
    beep(SOUND_NEW, 0.3)
    setStarted(true)
    try {
      await document.documentElement.requestFullscreen?.()
    } catch {
      /* plein écran refusé : pas grave */
    }
  }

  async function advance(t: TicketWithItems, status: TicketStatus) {
    setBusy((b) => new Set(b).add(t.id))
    await toast.attempt(status === 'pret' ? 'Passage en « Prêt »' : 'Prise en charge', async () => {
      must(await sb().from('tickets').update({ status }).eq('id', t.id).eq('status', t.status).select('id').single())
    })
    setBusy((b) => {
      const n = new Set(b)
      n.delete(t.id)
      return n
    })
    reload()
  }

  const tableNames = new Map(data?.tables.map((t) => [t.id, t.name]))
  const names = new Map(data?.profiles.map((p) => [p.id, p.display_name]))
  const tickets = data?.tickets ?? []
  const columns: { key: TicketStatus; title: string; color: string }[] = [
    { key: 'envoye', title: 'Nouveau', color: 'border-sky-400' },
    { key: 'en_preparation', title: 'En préparation', color: 'border-amber-400' },
    { key: 'pret', title: 'Prêt', color: 'border-emerald-400' },
  ]
  const byCol = (s: TicketStatus) =>
    tickets
      .filter((t) => t.status === s)
      .sort((a, b) => {
        const ka = s === 'pret' ? a.ready_at : a.sent_at
        const kb = s === 'pret' ? b.ready_at : b.sent_at
        return (ka ?? '').localeCompare(kb ?? '')
      })

  return (
    <div className="flex h-dvh flex-col">
      {flash > 0 && <div key={flash} className="animate-flash pointer-events-none fixed inset-0 z-40" />}
      {/* ---------- bandeau ---------- */}
      <header className="flex items-center gap-4 border-b border-line px-4 py-2">
        <span className="text-2xl font-black">Bar</span>
        <div
          className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 ${
            connected ? 'border-emerald-400' : 'border-red-500 bg-red-900'
          }`}
        >
          <ConnectionDot connected={connected} />
        </div>
        {!connected && <span className="text-sm text-red-300">Rafraîchissement toutes les 5 s</span>}
        <span className="text-sm text-muted">{wakeOk ? '☀ Écran allumé' : '⚠ Veille possible'}</span>
        <span className="ml-auto text-2xl font-bold tabular-nums">
          {new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {profile.role === 'admin' ? (
          <Link href="/" className="btn btn-sm btn-ghost">
            Quitter
          </Link>
        ) : (
          <button
            className="btn btn-sm btn-ghost"
            onClick={async () => {
              await sb().auth.signOut()
              router.push('/login')
            }}
          >
            Déconnexion
          </button>
        )}
      </header>

      {error && <div className="bg-red-800 px-4 py-1 text-sm">Erreur : {error} — nouvel essai automatique</div>}

      {/* ---------- colonnes ---------- */}
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 md:grid-cols-3">
        {columns.map((col) => {
          const list = byCol(col.key)
          return (
            <section key={col.key} className={`flex min-h-0 flex-col rounded-2xl border-t-4 bg-surface/60 ${col.color}`}>
              <h2 className="flex items-center justify-between px-3 py-2 text-xl font-bold">
                {col.title}
                <span className="rounded-full bg-white px-3 text-lg text-background">{list.length}</span>
              </h2>
              <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
                {list.map((t) => {
                  const since = col.key === 'pret' ? t.ready_at : t.sent_at
                  const mins = minutesSince(since, now)
                  const late = col.key !== 'pret' && mins >= LATE_MINUTES
                  const items = [...t.ticket_items].sort((a, b) => a.position - b.position)
                  return (
                    <article
                      key={t.id}
                      className={`rounded-2xl border-2 p-3 transition ${
                        late ? 'border-red-400 bg-red-950' : 'border-white/70 bg-surface-2'
                      } ${highlight.has(t.id) ? 'ring-4 ring-white' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-2xl leading-tight font-black">{tableNames.get(t.table_id) ?? '?'}</div>
                          <div className="text-sm text-muted">
                            #{t.number} · {names.get(t.waiter_id) ?? '?'}
                          </div>
                        </div>
                        <div className={`text-right text-2xl font-black tabular-nums ${late ? 'text-red-300' : ''}`}>
                          {mins} min
                        </div>
                      </div>
                      {t.modified_at && t.status !== 'pret' && (
                        <div className="mt-2 inline-block rounded-md bg-amber-400 px-2 py-0.5 text-sm font-black text-amber-950">
                          ⚠ MODIFIÉ
                        </div>
                      )}
                      <ul className="mt-2 space-y-1 text-xl">
                        {items.map((i) => (
                          <li key={i.id}>
                            <span className="font-black">{i.quantity}×</span> {i.product_name}
                            {i.note && <div className="pl-8 text-base font-semibold text-amber-300">↳ {i.note}</div>}
                          </li>
                        ))}
                      </ul>
                      {col.key === 'envoye' && (
                        <button
                          className="btn btn-primary mt-3 w-full py-4 text-xl"
                          disabled={busy.has(t.id)}
                          onClick={() => advance(t, 'en_preparation')}
                        >
                          Prendre en charge
                        </button>
                      )}
                      {col.key === 'en_preparation' && (
                        <button
                          className="btn btn-success mt-3 w-full py-4 text-xl"
                          disabled={busy.has(t.id)}
                          onClick={() => advance(t, 'pret')}
                        >
                          ✔ Prêt
                        </button>
                      )}
                      {col.key === 'pret' && <p className="mt-2 text-sm text-muted">En attente du serveur</p>}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* ---------- démarrage (débloque le son) ---------- */}
      {!started && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 p-6 text-center">
          <h1 className="text-4xl font-black">Écran bar</h1>
          <p className="max-w-md text-lg text-muted">
            Touchez le bouton pour activer l&apos;alerte sonore et garder l&apos;écran allumé. Pensez à brancher la tablette.
          </p>
          <button className="btn btn-primary px-10 py-6 text-2xl" onClick={start}>
            🔊 Activer le son et démarrer
          </button>
        </div>
      )}
    </div>
  )
}
