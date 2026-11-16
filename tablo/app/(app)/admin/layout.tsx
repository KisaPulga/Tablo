import { AdminNav } from '@/components/AdminNav'
import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireRole('admin')
  return (
    <div className="space-y-4">
      <AdminNav />
      {children}
    </div>
  )
}
