import { redirect } from 'next/navigation'
import { ViewerScreen } from '@/components/ViewerScreen'
import { requireRole } from '@/lib/auth'

export const metadata = { title: 'Ventes · Tablo' }

/** Écran seul du viewer (l'admin a l'onglet /ventes dans l'appli) */
export default async function ViewerPage() {
  const profile = await requireRole('viewer', 'admin')
  if (profile.role === 'admin') redirect('/ventes')
  return <ViewerScreen />
}
