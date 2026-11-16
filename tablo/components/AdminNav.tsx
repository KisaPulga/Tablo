'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin/tables', label: 'Tables' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/users', label: 'Utilisateurs' },
  { href: '/admin/decompte', label: 'Décompte' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`btn btn-sm shrink-0 ${pathname.startsWith(l.href) ? 'btn-primary' : 'btn-ghost'}`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  )
}
