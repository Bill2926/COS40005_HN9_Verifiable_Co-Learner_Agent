export interface UnlockStore {
  forStudent: (studentId: string) => Promise<string[]>
  record: (studentId: string, moduleIds: readonly string[]) => Promise<string[]>
}

export function createMemoryUnlockStore(): UnlockStore {
  const byStudent = new Map<string, Set<string>>()
  return {
    async forStudent(studentId) {
      return [...(byStudent.get(studentId) ?? [])]
    },
    async record(studentId, moduleIds) {
      const unlocked = byStudent.get(studentId) ?? new Set<string>()
      moduleIds.forEach(id => unlocked.add(id))
      byStudent.set(studentId, unlocked)
      return [...unlocked]
    },
  }
}
