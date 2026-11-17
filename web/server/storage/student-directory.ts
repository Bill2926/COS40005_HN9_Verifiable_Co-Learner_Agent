export interface AdminStudent {
  id: string
  displayName: string
  studentNumber: string
  email: string
}

export interface StudentNumberChange {
  studentId: string
  studentNumber: string
  actorEmail: string
}

export interface RecordedStudentNumberChange {
  studentId: string
  oldNumber: string
  newNumber: string
  actorEmail: string
}

export type StudentNumberChangeResult = 'changed' | 'unchanged' | 'not-found' | 'duplicate' | 'used'

export interface StudentDirectoryStore {
  list: () => Promise<AdminStudent[]>
  changeNumber: (change: StudentNumberChange) => Promise<StudentNumberChangeResult>
}

export function createMemoryStudentDirectoryStore(
  students: readonly AdminStudent[],
): StudentDirectoryStore & { changes: RecordedStudentNumberChange[] } {
  const stored = students.map(student => ({ ...student }))
  const changes: RecordedStudentNumberChange[] = []

  return {
    changes,
    async list() {
      return stored
        .map(student => ({ ...student }))
        .sort((left, right) => left.studentNumber.localeCompare(right.studentNumber))
    },
    async changeNumber({ studentId, studentNumber, actorEmail }: StudentNumberChange): Promise<StudentNumberChangeResult> {
      const student = stored.find(candidate => candidate.id === studentId)
      if (!student) return 'not-found'
      if (student.studentNumber === studentNumber) return 'unchanged'
      if (changes.some(change => (change.oldNumber === studentNumber || change.newNumber === studentNumber)
        && change.studentId !== studentId)) {
        return 'used'
      }
      if (stored.some(candidate => candidate.id !== studentId && candidate.studentNumber === studentNumber)) {
        return 'duplicate'
      }
      changes.push({ studentId, oldNumber: student.studentNumber, newNumber: studentNumber, actorEmail })
      student.studentNumber = studentNumber
      return 'changed'
    },
  }
}
