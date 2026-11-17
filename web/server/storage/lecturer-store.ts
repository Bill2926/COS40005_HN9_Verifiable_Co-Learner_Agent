import type { LecturerCourse } from '../../shared/lecturer'
import type { CourseSpec } from '../course'

export interface LecturerStore {
  forLecturer: (email: string) => Promise<LecturerCourse[]>
  setThreshold: (email: string, courseId: string, threshold: number) => Promise<boolean>
  exportSpec: (email: string, courseId: string) => Promise<CourseSpec | null>
  importSpec: (email: string, spec: CourseSpec) => Promise<boolean>
  readDraft: (email: string, courseId: string) => Promise<CourseSpec | null>
  saveDraft: (email: string, courseId: string, spec: CourseSpec) => Promise<boolean>
  discardDraft: (email: string, courseId: string) => Promise<boolean>
}

export function createMemoryLecturerStore(
  courses: readonly (LecturerCourse & { ownerEmail: string, spec?: CourseSpec, draft?: CourseSpec | null })[],
): LecturerStore {
  const stored = courses.map(course => ({
    ...course,
    history: [...course.history],
    students: course.students.map(student => ({ ...student })),
    draft: course.draft ? structuredClone(course.draft) : null,
  }))
  function owned(email: string, courseId: string) {
    return stored.find(item => item.ownerEmail === email && item.id === courseId)
  }
  return {
    async readDraft(email, courseId) {
      const draft = owned(email, courseId)?.draft
      return draft ? structuredClone(draft) : null
    },
    async saveDraft(email, courseId, spec) {
      const course = owned(email, courseId)
      if (!course || spec.courseId !== courseId) return false
      course.draft = structuredClone(spec)
      return true
    },
    async discardDraft(email, courseId) {
      const course = owned(email, courseId)
      if (!course) return false
      course.draft = null
      return true
    },
    async exportSpec(email, courseId) {
      const course = owned(email, courseId)
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
