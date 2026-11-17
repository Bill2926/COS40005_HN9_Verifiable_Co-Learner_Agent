// The student's deskmate switch: whether Mai takes part in their turns. One
// setting per student, the same across courses and devices, on by default.
export interface DeskmateSettingStore {
  read: (studentId: string) => Promise<boolean>
  save: (studentId: string, on: boolean) => Promise<void>
}

export function createMemoryDeskmateSettingStore(): DeskmateSettingStore {
  const settings = new Map<string, boolean>()
  return {
    async read(studentId) {
      return settings.get(studentId) ?? true
    },
    async save(studentId, on) {
      settings.set(studentId, on)
    },
  }
}
