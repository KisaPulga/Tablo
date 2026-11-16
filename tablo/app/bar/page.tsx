import { BarScreen } from '@/components/BarScreen'
import { requireRole } from '@/lib/auth'

export const metadata = { title: 'Bar · Tablo' }

export default async function BarPage() {
  const profile = await requireRole('bar', 'admin')
  return <BarScreen profile={profile} />
}
