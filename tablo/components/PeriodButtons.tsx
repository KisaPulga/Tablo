'use client'

/** Vendredi de l'événement : vendredi 20 novembre 2026 (mois 10 = novembre, comptés à partir de 0) */
export const EVENT_FRIDAY = new Date(2026, 10, 20)

function at(base: Date, addDays: number, hour: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, hour, 0)
}

/** Date → valeur d'un <input type="datetime-local"> (heure locale) */
export function toLocalInput(d: Date) {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}

const fri = EVENT_FRIDAY
export const PERIOD_PRESETS = [
  // vendredi : toute la journée jusqu'au samedi 4 h
  { label: 'Ven.', name: 'Vendredi', hours: 'vendredi 0 h → samedi 4 h', day: at(fri, 0, 0), from: toLocalInput(at(fri, 0, 0)), to: toLocalInput(at(fri, 1, 4)) },
  // samedi : 18 h jusqu'au dimanche 4 h
  { label: 'Sam.', name: 'Samedi', hours: 'samedi 18 h → dimanche 4 h', day: at(fri, 1, 0), from: toLocalInput(at(fri, 1, 18)), to: toLocalInput(at(fri, 2, 4)) },
]

export const OUTSIDE_EVENINGS = 'Hors soirée'

/** Soirée d'un ticket selon son heure d'envoi au bar (mêmes horaires que les boutons Ven. / Sam.) */
export function eveningOf(sentAt: string | null): string {
  if (!sentAt) return OUTSIDE_EVENINGS
  const ts = new Date(sentAt).getTime()
  const p = PERIOD_PRESETS.find((x) => ts >= new Date(x.from).getTime() && ts <= new Date(x.to).getTime())
  return p ? p.name : OUTSIDE_EVENINGS
}

/** Garde les tickets envoyés au bar dans la période (from/to au format datetime-local, vides = pas de borne) */
export function inPeriod<T extends { sent_at: string | null }>(tickets: T[], from: string, to: string): T[] {
  const fromTs = from ? new Date(from).getTime() : null
  const toTs = to ? new Date(to).getTime() : null
  if (fromTs == null && toTs == null) return tickets
  return tickets.filter((t) => {
    if (!t.sent_at) return false
    const ts = new Date(t.sent_at).getTime()
    return (fromTs == null || ts >= fromTs) && (toTs == null || ts <= toTs)
  })
}

/** Boutons « Tout / Ven. / Sam. » (toujours sur une seule ligne, même sur petit écran) */
export function PeriodButtons({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-sm font-bold">Période</span>
      <button
        className={`btn btn-sm min-w-0 flex-1 px-2 whitespace-nowrap ${!from && !to ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange('', '')}
      >
        Tout
      </button>
      {PERIOD_PRESETS.map((p) => (
        <button
          key={p.label}
          className={`btn btn-sm min-w-0 flex-[1.6] px-2 whitespace-nowrap ${
            from === p.from && to === p.to ? 'btn-primary' : 'btn-ghost'
          }`}
          onClick={() => onChange(p.from, p.to)}
        >
          {p.label} {p.day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
        </button>
      ))}
    </div>
  )
}
