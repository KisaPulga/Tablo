import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  const { count } = await supabase
    .from('tables')
    .select('*', { count: 'exact', head: true })

  return (
    <main className="min-h-screen p-4 space-y-4">
      <h1 className="text-2xl font-bold">Test de connexion</h1>
      {error ? (
        <p className="text-red-600">Erreur : {error.message}</p>
      ) : (
        <p>Connecté : <b>{profile?.display_name}</b> ({profile?.role})</p>
      )}
      <p>Nombre de tables dans la base : {count ?? 0}</p>
      <form action={signOut}>
        <button className="border rounded-lg px-4 py-2">Se déconnecter</button>
      </form>
    </main>
  )
}