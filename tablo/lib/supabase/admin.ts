import { createClient } from '@supabase/supabase-js'

/**
 * Client « administrateur » (clé secrète) : contourne la RLS.
 * À n'utiliser QUE dans du code serveur (Server Actions), jamais dans un composant client.
 * La variable SUPABASE_SECRET_KEY ne doit PAS commencer par NEXT_PUBLIC_
 * (sinon elle serait envoyée aux navigateurs).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('Variable SUPABASE_SECRET_KEY manquante (Vercel + .env.local)')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
