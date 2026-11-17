/**
 * Icône de l'app (onglet, écran d'accueil iPhone/Android), dessinée en JSX pour ImageResponse.
 * Fond plein (pas de transparence : iOS remplit la transparence en noir et arrondit lui-même les coins).
 */
export function AppIcon({ size }: { size: number }) {
  const s = (ratio: number) => Math.round(size * ratio)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // même dégradé diagonal que le fond de l'app, un peu plus lumineux
        background: 'linear-gradient(135deg, #1d4594 0%, #10285a 45%, #07142b 100%)',
      }}
    >
      <div
        style={{
          width: s(0.62),
          height: s(0.62),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: s(0.16),
          border: `${Math.max(2, s(0.045))}px solid white`,
          background: 'rgba(47, 111, 237, 0.35)',
        }}
      >
        {/* « T » dessiné avec deux barres (la police par défaut n'a pas de graisse épaisse) */}
        <div style={{ width: s(0.3), height: s(0.075), borderRadius: s(0.015), background: 'white' }} />
        <div style={{ width: s(0.08), height: s(0.25), borderRadius: s(0.015), background: 'white' }} />
      </div>
    </div>
  )
}
