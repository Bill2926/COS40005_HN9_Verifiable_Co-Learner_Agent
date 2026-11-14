import type { LecturerCourse } from '../../shared/lecturer'

export interface LecturerStore {
  forLecturer: (email: string) => Promise<LecturerCourse[]>
}

export function createMemoryLecturerStore(
  courses: readonly (LecturerCourse & { ownerEmail: string })[],
): LecturerStore {
  return {
    async forLecturer(email) {
      return courses.filter(course => course.ownerEmail === email)
        .map(({ id, title, enrolledCount, history }) => ({
          id, title, enrolledCount, history: history.map(entry => ({ ...entry })),
        }))
    },
  }
}
