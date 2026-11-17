import type { LecturerCourse } from '../../shared/lecturer'
import type { CourseSpec } from '../course'

export interface LecturerStore {
  forLecturer: (email: string) => Promise<LecturerCourse[]>
  setThreshold: (email: string, courseId: string, threshold: number) => Promise<boolean>
  exportSpec: (email: string, courseId: string) => Promise<CourseSpec | null>
  importSpec: (email: string, spec: CourseSpec) => Promise<boolean>
}

export function createMemoryLecturerStore(
  courses: readonly (LecturerCourse & { ownerEmail: string, spec?: CourseSpec })[],
): LecturerStore {
  const stored = courses.map(course => ({
    ...course,
    history: [...course.history],
    students: course.students.map(student => ({ ...student })),
  }))
  return {
    async exportSpec(email, courseId) {
      const course = stored.find(item => item.ownerEmail === email && item.id === courseId)
      return course?.spec ? structuredClone({ ...course.spec, masteryThreshold: course.masteryThreshold }) : null
    },
    async importSpec(email, spec) {
      const course = stored.find(item => item.ownerEmail === email && item.id === spec.courseId)
      if (!course) return false
      course.spec = structuredClone(spec)
      course.title = spec.title
      course.masteryThreshold = spec.masteryThreshold
      course.history.unshift({ action: 'course_spec_imported', actorEmail: email, time: new Date().toISOString() })
      return true
    },
    async forLecturer(email) {
      return stored.filter(course => course.ownerEmail === email)
        .map(({ id, title, enrolledCount, masteryThreshold, history, students }) => ({
          id,
          title,
          enrolledCount,
          masteryThreshold,
          history: history.map(entry => ({ ...entry })),
          students: students.map(student => ({ ...student })),
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
