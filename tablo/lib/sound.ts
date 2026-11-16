'use client'

// Bips générés avec Web Audio (aucun fichier son à charger)
let ctx: AudioContext | null = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** À appeler suite à un geste de l'utilisateur (les navigateurs bloquent le son sinon) */
export async function unlockAudio() {
  const c = getCtx()
  if (!c) return false
  if (c.state === 'suspended') await c.resume()
  // bip silencieux pour finir de débloquer iOS
  const o = c.createOscillator()
  const g = c.createGain()
  g.gain.value = 0
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.01)
  return c.state === 'running'
}

export function audioUnlocked() {
  return ctx?.state === 'running'
}

/** Joue une suite de notes (fréquence Hz, durée s) */
export function beep(notes: [number, number][] = [[880, 0.15], [1320, 0.25]], volume = 0.4) {
  const c = getCtx()
  if (!c || c.state !== 'running') return
  let t = c.currentTime
  for (const [freq, dur] of notes) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(volume, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + dur + 0.02)
    t += dur + 0.05
  }
}

export const SOUND_NEW: [number, number][] = [[880, 0.15], [1320, 0.3]]
export const SOUND_MODIFIED: [number, number][] = [[660, 0.12], [660, 0.12]]
export const SOUND_READY: [number, number][] = [[1046, 0.12], [1318, 0.12], [1568, 0.3]]
