import type { MetadataRoute } from 'next'

// Installation comme une vraie app (Android / Chrome ; iOS utilise apple-icon + les balises du layout)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tablo',
    short_name: 'Tablo',
    description: 'Prise de commande et écran bar pour la soirée',
    start_url: '/',
    display: 'standalone',
    background_color: '#07142b',
    theme_color: '#07142b',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
