import { ViewerScreen } from '@/components/ViewerScreen'
import { requireRole } from '@/lib/auth'

export const metadata = { title: 'Ventes · Tablo' }

/** Onglet « Ventes » de l'admin : même écran que le viewer, dans l'appli */
export default async function VentesPage() {
  await requireRole('admin')
  return <ViewerScreen embedded />
}
