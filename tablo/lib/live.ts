'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

let browserClient: SupabaseClient | null = null
export function sb() {
  if (!browserClient) browserClient = createClient()
  return browserClient
}

/** Lève une erreur lisible si la requête Supabase a échoué */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Récupère toutes les lignes (Supabase limite à 1000 par requête) */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const rows = must(await query(from, from + pageSize - 1)) as T[] | null
    if (!rows) break
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

type LiveOptions = {
  /** tables surveillées par Realtime */
  tables: string[]
  /** rafraîchissement de secours (ms) quand le temps réel est coupé */
  fallbackMs?: number
  /** clé qui force un rechargement complet quand elle change (ex. id de route) */
  key?: string
}

/**
 * Charge des données et les garde à jour :
 * - abonnement Supabase Realtime sur les tables indiquées (rechargement à chaque changement)
 * - rafraîchissement périodique si le temps réel est coupé
 * - rechargement au retour au premier plan / retour du réseau
 */
export function useLive<T>(fetcher: () => Promise<T>, { tables, fallbackMs = 8000, key = '' }: LiveOptions) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [realtimeOk, setRealtimeOk] = useState(false)
  const [online, setOnline] = useState(true)

  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const loadRef = useRef<() => Promise<void>>(async () => {})
  const reload = useCallback(() => loadRef.current(), [])

  const tablesKey = tables.join(',')

  useEffect(() => {
    let cancelled = false
    let pending = false
    let again = false
    let debounce: ReturnType<typeof setTimeout> | undefined
    let rtOk = false

    const load = async () => {
      if (pending) {
        again = true
        return
      }
      pending = true
      try {
        const d = await fetcherRef.current()
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        pending = false
        if (again && !cancelled) {
          again = false
          load()
        }
      }
    }
    loadRef.current = load
    const schedule = () => {
      clearTimeout(debounce)
      debounce = setTimeout(load, 150)
    }

    load()

    const client = sb()
    const channel = client.channel(`live:${tablesKey}:${key}:${Math.random().toString(36).slice(2)}`)
    for (const t of tablesKey.split(',').filter(Boolean)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, schedule)
    }
    channel.subscribe((status) => {
      if (cancelled) return
      const ok = status === 'SUBSCRIBED'
      if (ok && !rtOk) load() // rattrape ce qui a été manqué pendant la coupure
      rtOk = ok
      setRealtimeOk(ok)
    })

    // secours rapide si le temps réel est coupé…
    const poll = setInterval(() => {
      if (!rtOk) load()
    }, fallbackMs)
    // …et filet de sécurité lent même quand il fonctionne
    const slowPoll = setInterval(load, 60000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    const onOnline = () => {
      setOnline(true)
      load()
    }
    const onOffline = () => setOnline(false)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      cancelled = true
      clearTimeout(debounce)
      clearInterval(poll)
      clearInterval(slowPoll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      client.removeChannel(channel)
    }
  }, [tablesKey, key, fallbackMs])

  return { data, error, connected: realtimeOk && online && !error, reload }
}

/** Horloge qui se met à jour régulièrement (pour les anciennetés) */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
