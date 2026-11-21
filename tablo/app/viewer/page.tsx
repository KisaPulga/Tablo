import { ViewerScreen } from '@/components/ViewerScreen'
import { requireRole } from '@/lib/auth'

export const metadata = { title: 'Ventes · Tablo' }

export default async function ViewerPage() {
  const profile = await requireRole('viewer', 'admin')
  return <ViewerScreen profile={profile} />
}
