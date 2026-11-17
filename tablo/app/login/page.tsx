'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sb } from '@/lib/live'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setError('Email ou mot de passe incorrect.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    // espace au-dessus (1 part) / en dessous (2 parts) : le milieu du formulaire tombe au tiers supérieur
    <main className="fixed inset-0 flex touch-none flex-col items-center overflow-hidden overscroll-none px-4 py-6">
      <div className="flex-1" />
      <form onSubmit={handleSubmit} className="w-full max-w-sm shrink-0 space-y-4">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">Tablo</h1>
          <p className="text-muted">Connexion réservée aux invités</p>
        </div>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input text-lg"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input text-lg"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 text-lg">
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <div className="flex-[2]" />
    </main>
  )
}
