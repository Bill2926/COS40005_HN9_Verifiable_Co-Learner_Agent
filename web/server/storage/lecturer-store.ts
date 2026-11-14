import type { LecturerCourse } from '../../shared/lecturer'

export interface LecturerStore {
  forLecturer: (email: string) => Promise<LecturerCourse[]>
  setThreshold: (email: string, courseId: string, threshold: number) => Promise<boolean>
}

export function createMemoryLecturerStore(
  courses: readonly (LecturerCourse & { ownerEmail: string })[],
): LecturerStore {
  const stored = courses.map(course => ({ ...course, history: [...course.history] }))
  return {
    async forLecturer(email) {
      return stored.filter(course => course.ownerEmail === email)
        .map(({ id, title, enrolledCount, masteryThreshold, history }) => ({
          id, title, enrolledCount, masteryThreshold, history: history.map(entry => ({ ...entry })),
        }))
    },
    async setThreshold(email, courseId, threshold) {
      const course = stored.find(item => item.ownerEmail === email && item.id === courseId)
      if (!course) return false
      if (course.masteryThreshold !== threshold) {
        course.history.unshift({
          action: 'mastery_threshold_changed',
          actorEmail: email,
          time: new Date().toISOString(),
          previousThreshold: course.masteryThreshold,
          masteryThreshold: threshold,
        })
        course.masteryThreshold = threshold
      }
      return true
    },
  }
}
