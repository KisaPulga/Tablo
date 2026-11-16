'use server'

import { headers } from 'next/headers'
import { refresh } from 'next/cache'
import { getSessionProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Role } from '@/lib/types'

type Result = { error?: string; ok?: string }

const ROLES: Role[] = ['admin', 'serveur', 'bar']

/** Chaque action revérifie que l'appelant est admin (une Server Action est un endpoint public). */
async function assertAdmin() {
  const { profile } = await getSessionProfile()
  if (profile?.role !== 'admin') throw new Error('Réservé à l’admin')
}

function clean(input: { email?: string; display_name?: string; role?: string }) {
  const email = (input.email ?? '').trim().toLowerCase()
  const display_name = (input.display_name ?? '').trim()
  const role = (ROLES.includes(input.role as Role) ? input.role : 'serveur') as Role
  return { email, display_name, role }
}

export async function createUserAction(input: {
  email: string
  password: string
  display_name: string
  role: string
}): Promise<Result> {
  try {
    await assertAdmin()
    const { email, display_name, role } = clean(input)
    if (!email || !display_name) return { error: 'Email et nom obligatoires' }
    if ((input.password ?? '').length < 6) return { error: 'Mot de passe : 6 caractères minimum' }

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_name },
    })
    if (error) return { error: error.message }

    const { error: pErr } = await admin.from('profiles').update({ display_name, role }).eq('id', data.user.id)
    if (pErr) return { error: pErr.message }
    refresh()
    return { ok: `Compte créé pour ${display_name}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function inviteUserAction(input: { email: string; display_name: string; role: string }): Promise<Result> {
  try {
    await assertAdmin()
    const { email, display_name, role } = clean(input)
    if (!email || !display_name) return { error: 'Email et nom obligatoires' }

    const h = await headers()
    const origin = h.get('origin') ?? `https://${h.get('host')}`
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name },
      redirectTo: `${origin}/auth/set-password`,
    })
    if (error) return { error: error.message }

    const { error: pErr } = await admin.from('profiles').update({ display_name, role }).eq('id', data.user.id)
    if (pErr) return { error: pErr.message }
    refresh()
    return { ok: `Invitation envoyée à ${email}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateProfileAction(input: { id: string; display_name: string; role: string }): Promise<Result> {
  try {
    await assertAdmin()
    const { display_name, role } = clean(input)
    if (!display_name) return { error: 'Nom obligatoire' }
    const { profile } = await getSessionProfile()
    if (profile?.id === input.id && role !== 'admin') return { error: 'Tu ne peux pas retirer ton propre rôle admin' }

    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({ display_name, role }).eq('id', input.id)
    if (error) return { error: error.message }
    refresh()
    return { ok: 'Profil mis à jour' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function setPasswordAction(input: { id: string; password: string }): Promise<Result> {
  try {
    await assertAdmin()
    if ((input.password ?? '').length < 6) return { error: 'Mot de passe : 6 caractères minimum' }
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(input.id, { password: input.password })
    if (error) return { error: error.message }
    return { ok: 'Mot de passe changé' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
