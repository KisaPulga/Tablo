import Link from 'next/link'

export const metadata = { title: 'Page introuvable · Tablo' }

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-7xl font-black text-muted">404</p>
      <h1 className="text-2xl font-bold">Hmm... Cette page n&apos;existe pas</h1>
      <Link href="/" className="btn btn-primary">
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
