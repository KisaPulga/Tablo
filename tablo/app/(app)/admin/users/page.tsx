import { UsersAdmin, type UserRow } from '@/components/UsersAdmin'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'

export default async function AdminUsersPage() {
  const me = await requireRole('admin')

  let users: UserRow[] = []
  let configError: string | null = null
  try {
    const admin = createAdminClient()
    const [{ data: profiles, error: pErr }, { data: authData, error: aErr }] = await Promise.all([
      admin.from('profiles').select('id, display_name, role').order('display_name'),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ])
    if (pErr) throw new Error(pErr.message)
    if (aErr) throw new Error(aErr.message)
    const byId = new Map(authData.users.map((u) => [u.id, u]))
    users = (profiles as Profile[]).map((p) => {
      const u = byId.get(p.id)
      return {
        ...p,
        email: u?.email ?? '',
        last_sign_in_at: u?.last_sign_in_at ?? null,
        invited_pending: !!u?.invited_at && !u?.last_sign_in_at,
      }
    })
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e)
  }

  return <UsersAdmin users={users} meId={me.id} configError={configError} />
}
