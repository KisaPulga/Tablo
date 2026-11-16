'use client'

import { useEffect, useState } from 'react'
import { STATUS_CLASS, STATUS_LABEL, type TicketStatus } from '@/lib/types'

export function StatusChip({ status }: { status: TicketStatus }) {
  return <span className={`chip ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
}

export function ConnectionDot({ connected, label = true }: { connected: boolean; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" title={connected ? 'Connecté' : 'Hors ligne'}>
      <span className={`h-3 w-3 rounded-full ${connected ? 'bg-emerald-400' : 'animate-pulse bg-red-500'}`} />
      {label && <span className={connected ? 'text-emerald-300' : 'text-red-300'}>{connected ? 'En ligne' : 'Hors ligne'}</span>}
    </span>
  )
}

/** Bouton à double appui : 1er appui → « Confirmer ? », 2e appui → action */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Confirmer ?',
  className = 'btn btn-danger',
  disabled,
}: {
  onConfirm: () => void
  children: React.ReactNode
  confirmLabel?: string
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${className} ${armed ? 'animate-pulse' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}

export function Loading({ error }: { error?: string | null }) {
  if (error)
    return (
      <div className="card m-4 border-red-500 p-4 text-red-200">
        Erreur de chargement : {error}
        <br />
        <span className="text-sm text-muted">Nouvel essai automatique…</span>
      </div>
    )
  return <div className="p-8 text-center text-muted">Chargement…</div>
}
