'use client'

import { createContext, useContext } from 'react'
import type { Profile } from '@/lib/types'

const ProfileContext = createContext<Profile | null>(null)

export function ProfileProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const p = useContext(ProfileContext)
  if (!p) throw new Error('useProfile doit être utilisé dans <ProfileProvider>')
  return p
}
