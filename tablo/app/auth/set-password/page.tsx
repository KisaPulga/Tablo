'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { sb } from '@/lib/live'

/**
 * Page d'arrivée du lien d'invitation : récupère la session depuis l'URL
 * puis demande à la personne de choisir son mot de passe.
 */
export default function SetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = sb()
    ;(async () => {
      try {
        const url = new URL(window.location.href)
        const hash = new URLSearchParams(url.hash.slice(1))
        const code = url.searchParams.get('code')
        const tokenHash = url.searchParams.get('token_hash')
        const errDesc = hash.get('error_description') ?? url.searchParams.get('error_description')

        if (errDesc) throw new Error(errDesc)
        if (hash.get('access_token') && hash.get('refresh_token')) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get('access_token')!,
            refresh_token: hash.get('refresh_token')!,
          })
          if (error) throw error
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (url.searchParams.get('type') as 'invite') ?? 'invite',
          })
          if (error) throw error
        }
        window.history.replaceState(null, '', url.pathname)
        const { data } = await supabase.auth.getUser()
        if (!data.user) throw new Error('Lien invalide ou expiré. Demande une nouvelle invitation.')
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await sb().auth.updateUser({ password })
    setSaving(false)
    if (error) return setError(error.message)
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-3xl font-black">Bienvenue sur Tablo</h1>
        {error && <p className="card border-red-500 p-3 text-red-200">{error}</p>}
        {!ready && !error && <p className="text-center text-muted">Vérification du lien…</p>}
        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-muted">Choisis ton mot de passe :</p>
            <input
              type="password"
              className="input text-lg"
              placeholder="Mot de passe (6 caractères min.)"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn btn-primary w-full py-3 text-lg" disabled={saving}>
              {saving ? '…' : 'Valider'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
