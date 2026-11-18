import type { Campus } from '../../shared/campus'

export interface AdminStudent {
  id: string
  displayName: string
  studentNumber: string
  email: string
  campus: Campus | null
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

export interface CampusChange {
  studentId: string
  campus: Campus
  actorEmail: string
}

export interface RecordedCampusChange {
  studentId: string
  oldCampus: Campus | null
  newCampus: Campus
  actorEmail: string
}

export type CampusChangeResult = 'changed' | 'unchanged' | 'not-found'

export type StudentNumberChangeResult = 'changed' | 'unchanged' | 'not-found' | 'duplicate' | 'used'

export interface StudentDirectoryStore {
  list: () => Promise<AdminStudent[]>
  changeNumber: (change: StudentNumberChange) => Promise<StudentNumberChangeResult>
  changeCampus: (change: CampusChange) => Promise<CampusChangeResult>
}

export function createMemoryStudentDirectoryStore(
  students: readonly AdminStudent[],
): StudentDirectoryStore & { changes: RecordedStudentNumberChange[], campusChanges: RecordedCampusChange[] } {
  const stored = students.map(student => ({ ...student }))
  const changes: RecordedStudentNumberChange[] = []
  const campusChanges: RecordedCampusChange[] = []

  return {
    changes,
    campusChanges,
    async list() {
      return stored
        .map(student => ({ ...student }))
        .sort((left, right) => left.studentNumber.localeCompare(right.studentNumber))
    },
    async changeCampus({ studentId, campus, actorEmail }) {
      const student = stored.find(candidate => candidate.id === studentId)
      if (!student) return 'not-found'
      if (student.campus === campus) return 'unchanged'
      campusChanges.push({ studentId, oldCampus: student.campus, newCampus: campus, actorEmail })
      student.campus = campus
      return 'changed'
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
