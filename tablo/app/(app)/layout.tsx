import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { getSessionProfile } from '@/lib/auth'
import { SignOutButton } from '@/components/SignOutButton'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { profile, email } = await getSessionProfile()

  if (!profile) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Accès non autorisé</h1>
        <p className="text-muted">Le compte {email} n&apos;a pas de profil. Demande à l&apos;organisateur de t&apos;inviter.</p>
        <SignOutButton />
      </main>
    )
  }

  // La tablette du bar n'a besoin que de l'écran bar
  if (profile.role === 'bar') redirect('/bar')

  return <AppShell profile={profile}>{children}</AppShell>
}
