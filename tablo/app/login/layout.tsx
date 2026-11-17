import type { Viewport } from 'next'

// Page de connexion : la barre du navigateur prend la couleur du haut du dégradé
// (au lieu du bleu nuit uni de l'app) pour qu'aucun bandeau ne se détache.
export const viewport: Viewport = {
  themeColor: '#0e2350',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
