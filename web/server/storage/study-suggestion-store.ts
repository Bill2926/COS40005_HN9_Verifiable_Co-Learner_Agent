// The study suggestions a student has dismissed, one row per student, course
// and step. A dismissal is not evidence: it is only the memory that this
// episode of the step was closed. Students never read or write it directly.
export interface StudySuggestionStore {
  // The activity row each dismissed step was last dismissed at, by step identity.
  dismissed: (studentId: string) => Promise<ReadonlyMap<string, number>>
  // Remembers that the step was dismissed at this activity row. A later dismissal
  // of the same step replaces the earlier one.
  dismiss: (studentId: string, identity: string, anchor: number) => Promise<void>
}

export function createMemoryStudySuggestionStore(): StudySuggestionStore {
  const byStudent = new Map<string, Map<string, number>>()
  return {
    async dismissed(studentId) {
      return new Map(byStudent.get(studentId) ?? [])
    },
    async dismiss(studentId, identity, anchor) {
      const steps = byStudent.get(studentId) ?? new Map<string, number>()
      steps.set(identity, anchor)
      byStudent.set(studentId, steps)
    },
  }
}
