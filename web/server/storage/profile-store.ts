// A student's profile as the server stores it. The student number is not here:
// nothing on this store can change it, and the campus can only be chosen once. Email comes from the session, not the row.

import type { Campus } from '../../shared/campus'

export interface StoredProfile {
  displayName: string
  studentNumber: string
  campus: Campus | null
  picturePath: string | null
}

export interface ProfileChange {
  displayName?: string
  picturePath?: string | null
}

export type CampusChoiceResult = 'chosen' | 'already-chosen'

export interface ProfileStore {
  read: (studentId: string) => Promise<StoredProfile>
  chooseCampus: (studentId: string, campus: Campus) => Promise<CampusChoiceResult>
  save: (studentId: string, change: ProfileChange) => Promise<StoredProfile>
}

export function createMemoryProfileStore(profiles: Readonly<Record<string, StoredProfile>>): ProfileStore {
  const stored = new Map(Object.entries(profiles).map(([id, profile]) => [id, { ...profile }]))
  return {
    async read(studentId) {
      const profile = stored.get(studentId)
      if (!profile) throw new Error('That student has no profile.')
      return { ...profile }
    },
    async chooseCampus(studentId, campus) {
      const profile = stored.get(studentId)
      if (!profile) throw new Error('That student has no profile.')
      if (profile.campus !== null) return 'already-chosen'
      profile.campus = campus
      return 'chosen'
    },
    async save(studentId, change) {
      const profile = stored.get(studentId)
      if (!profile) throw new Error('That student has no profile.')
      if (change.displayName !== undefined) profile.displayName = change.displayName
      if (change.picturePath !== undefined) profile.picturePath = change.picturePath
      return { ...profile }
    },
  }
}
