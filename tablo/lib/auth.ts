import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/lib/types'

/** Utilisateur connecté + profil (redirige vers /login sinon). Côté serveur uniquement. */
export async function getSessionProfile(): Promise<{ profile: Profile | null; email: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', user.id)
    .maybeSingle()

  return { profile: (profile as Profile | null) ?? null, email: user.email ?? null }
}

/** Exige un profil avec l'un des rôles donnés, sinon redirige vers l'accueil. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const { profile } = await getSessionProfile()
  if (!profile) redirect('/login')
  if (!roles.includes(profile.role)) redirect('/')
  return profile
}
