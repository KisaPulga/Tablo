'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ProfileProvider } from '@/components/ProfileContext'
import { useToast } from '@/components/Toaster'
import { ConnectionDot } from '@/components/ui'
import { must, sb, useLive } from '@/lib/live'
import { SOUND_READY, beep, unlockAudio } from '@/lib/sound'
import { ROLE_LABEL, type Profile } from '@/lib/types'

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Débloque le son au premier toucher (sinon les navigateurs le bloquent)
  useEffect(() => {
    const unlock = () => void unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  async function signOut() {
    await sb().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = [
    { href: '/', label: 'Tables', icon: '▦', active: pathname === '/' || pathname.startsWith('/table') },
    { href: '/tickets', label: 'Tickets', icon: '☰', active: pathname.startsWith('/tickets') || pathname.startsWith('/ticket/') },
    ...(profile.role === 'admin'
      ? [
          { href: '/bar', label: 'Bar', icon: '🍸', active: false },
          { href: '/ventes', label: 'Ventes', icon: '🏆', active: pathname.startsWith('/ventes') },
          { href: '/admin', label: 'Admin', icon: '⚙', active: pathname.startsWith('/admin') },
        ]
      : []),
  ]

  return (
    <ProfileProvider profile={profile}>
      <header className="sticky top-0 z-30 border-b border-line bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <Link href="/" className="text-xl font-black tracking-tight">
            Tablo
          </Link>
          <ConnectionIndicator />
          <div className="ml-auto text-right text-sm leading-tight">
            <div className="font-semibold">{profile.display_name}</div>
            <div className="text-xs text-muted">{ROLE_LABEL[profile.role]}</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={signOut}>
            Déconnexion
          </button>
        </div>
      </header>

      <ReadyNotifier profile={profile} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2 px-3 py-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl border-2 text-xs font-semibold ${
                n.active ? 'border-white bg-accent' : 'border-white/40 text-muted'
              }`}
            >
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </ProfileProvider>
  )
}

/** Indicateur de connexion temps réel (vert / rouge) */
function ConnectionIndicator() {
  const { connected } = useLive(async () => true, { tables: ['tables'] })
  return <ConnectionDot connected={connected} />
}

type ReadyTicket = { id: string; number: number; table: { name: string } | null }

/** Prévient le serveur quand un de ses tickets passe « Prêt » */
function ReadyNotifier({ profile }: { profile: Profile }) {
  const toast = useToast()
  const seen = useRef<Set<string> | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const { data } = useLive(
    async () =>
      must(
        await sb()
          .from('tickets')
          .select('id, number, table:tables(name)')
          .eq('waiter_id', profile.id)
          .eq('status', 'pret')
          .order('ready_at'),
      ) as unknown as ReadyTicket[],
    { tables: ['tickets'], fallbackMs: 6000, key: profile.id },
  )

  useEffect(() => {
    if (!data) return
    const ids = new Set(data.map((t) => t.id))
    if (seen.current) {
      const fresh = data.filter((t) => !seen.current!.has(t.id))
      if (fresh.length > 0) {
        beep(SOUND_READY, 0.5)
        navigator.vibrate?.([200, 100, 200, 100, 300])
      }
    }
    seen.current = ids
  }, [data])

  if (profile.role === 'bar') return null
  const visible = (data ?? []).filter((t) => !dismissed.has(t.id))
  if (visible.length === 0) return null

  async function markServed(id: string) {
    const ok = await toast.attempt('Marquer servi', async () => {
      must(await sb().from('tickets').update({ status: 'servi' }).eq('id', id).select('id').single())
    })
    if (ok) toast.success('Ticket servi ✔')
  }

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 mx-auto w-full max-w-3xl space-y-2 px-4 pt-3">
      {visible.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-2xl border-2 border-white bg-emerald-700 px-4 py-3 shadow-xl">
          <span className="text-2xl">🔔</span>
          <div className="flex-1 leading-tight">
            <div className="font-bold">Prêt au bar !</div>
            <div className="text-sm">
              Ticket #{t.number} · {t.table?.name ?? 'Table ?'}
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => markServed(t.id)}>
            Servi
          </button>
          <button
            aria-label="Masquer"
            className="text-2xl leading-none"
            onClick={() => setDismissed((s) => new Set(s).add(t.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
