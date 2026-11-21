'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/Toaster'
import {
  createUserAction,
  inviteUserAction,
  setPasswordAction,
  updateProfileAction,
} from '@/app/(app)/admin/users/actions'
import { ROLE_LABEL, type Profile, type Role } from '@/lib/types'

export type UserRow = Profile & { email: string; last_sign_in_at: string | null; invited_pending: boolean }

const ROLES: Role[] = ['serveur', 'bar', 'viewer', 'admin']

export function UsersAdmin({ users, meId, configError }: { users: UserRow[]; meId: string; configError: string | null }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'password' | 'invite'>('password')
  const [form, setForm] = useState({ email: '', display_name: '', role: 'serveur', password: '' })

  function run(fn: () => Promise<{ error?: string; ok?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else {
        if (res.ok) toast.success(res.ok)
        onOk?.()
      }
    })
  }

  if (configError) {
    return (
      <div className="card space-y-2 border-red-500 p-4">
        <h1 className="text-xl font-bold">Utilisateurs</h1>
        <p className="text-red-200">Impossible de charger les utilisateurs : {configError}</p>
        <p className="text-sm text-muted">
          Ajoute la variable <code>SUPABASE_SECRET_KEY</code> (clé secrète Supabase, sans préfixe NEXT_PUBLIC_) dans{' '}
          <code>.env.local</code> et dans les variables d&apos;environnement Vercel, puis redéploie.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>

      <form
        className="card space-y-2 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const reset = () => setForm({ email: '', display_name: '', role: form.role, password: '' })
          if (mode === 'password') run(() => createUserAction(form), reset)
          else run(() => inviteUserAction(form), reset)
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`btn btn-sm ${mode === 'password' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('password')}>
            Créer avec mot de passe
          </button>
          <button type="button" className={`btn btn-sm ${mode === 'invite' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('invite')}>
            Inviter par email
          </button>
        </div>
        <input
          className="input"
          placeholder="Nom affiché"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoCapitalize="none"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        {mode === 'password' && (
          <input
            className="input"
            type="text"
            placeholder="Mot de passe (6 caractères min.)"
            autoCapitalize="none"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
        )}
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? '…' : mode === 'password' ? 'Créer le compte' : 'Envoyer l’invitation'}
        </button>
      </form>

      <ul className="space-y-2">
        {users.map((u) => (
          <UserItem key={u.id} user={u} isMe={u.id === meId} pending={pending} run={run} />
        ))}
      </ul>
    </div>
  )
}

function UserItem({
  user: u,
  isMe,
  pending,
  run,
}: {
  user: UserRow
  isMe: boolean
  pending: boolean
  run: (fn: () => Promise<{ error?: string; ok?: string }>, onOk?: () => void) => void
}) {
  const [name, setName] = useState(u.display_name)
  const [role, setRole] = useState<Role>(u.role)
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const changed = name.trim() !== u.display_name || role !== u.role

  return (
    <li className="card space-y-2 p-3">
      <div className="text-sm text-muted">
        {u.email} {isMe && '(toi)'} {u.invited_pending && <span className="chip bg-amber-400 text-amber-950">invitation en attente</span>}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom affiché" />
        <select className="input w-32" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isMe} aria-label="Rôle">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {changed && (
          <button
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={() => run(() => updateProfileAction({ id: u.id, display_name: name, role }))}
          >
            Enregistrer
          </button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={() => setShowPwd(!showPwd)}>
          Changer le mot de passe
        </button>
      </div>
      {showPwd && (
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Nouveau mot de passe"
            autoCapitalize="none"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
          <button
            className="btn btn-sm shrink-0"
            disabled={pending || pwd.length < 6}
            onClick={() =>
              run(
                () => setPasswordAction({ id: u.id, password: pwd }),
                () => {
                  setPwd('')
                  setShowPwd(false)
                },
              )
            }
          >
            Valider
          </button>
        </div>
      )}
    </li>
  )
}
