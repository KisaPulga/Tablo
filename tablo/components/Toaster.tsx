'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type Toast = {
  id: number
  kind: 'error' | 'success' | 'info'
  message: string
  retry?: () => void
}

type ToastApi = {
  error: (message: string, retry?: () => void) => void
  success: (message: string) => void
  info: (message: string) => void
  /**
   * Exécute une écriture ; en cas d'échec, affiche l'erreur avec un bouton « Réessayer ».
   * Retourne true si l'écriture a réussi.
   */
  attempt: (label: string, fn: () => Promise<unknown>) => Promise<boolean>
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <Toaster>')
  return ctx
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      // une même erreur répétée (ex. enregistrement auto) remplace la précédente au lieu de s'empiler
      setToasts((list) => [...list.filter((x) => x.message !== t.message).slice(-3), { ...t, id }])
      // les erreurs restent jusqu'à action de l'utilisateur
      if (t.kind !== 'error') setTimeout(() => dismiss(id), 2500)
    },
    [dismiss],
  )

  const error = useCallback((message: string, retry?: () => void) => push({ kind: 'error', message, retry }), [push])
  const success = useCallback((message: string) => push({ kind: 'success', message }), [push])
  const info = useCallback((message: string) => push({ kind: 'info', message }), [push])

  const attempt = useCallback(
    (label: string, fn: () => Promise<unknown>): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        try {
          await fn()
          return true
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          error(`${label} : échec (${msg})`, () => void run())
          return false
        }
      }
      return run()
    },
    [error],
  )

  return (
    <ToastContext.Provider value={{ error, success, info, attempt }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border-2 border-white px-4 py-3 shadow-xl ${
              t.kind === 'error' ? 'bg-red-800' : t.kind === 'success' ? 'bg-emerald-800' : 'bg-surface-2'
            }`}
          >
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            {t.retry && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  dismiss(t.id)
                  t.retry?.()
                }}
              >
                Réessayer
              </button>
            )}
            <button className="text-xl leading-none text-white/80" aria-label="Fermer" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
