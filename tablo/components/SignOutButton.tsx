'use client'

import { useRouter } from 'next/navigation'
import { sb } from '@/lib/live'

export function SignOutButton({ className = 'btn' }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      className={className}
      onClick={async () => {
        await sb().auth.signOut()
        router.push('/login')
        router.refresh()
      }}
    >
      Se déconnecter
    </button>
  )
}
