import type { EvidenceStore } from './evidence-store'
import { saveMasteryFromEvidence, type MasteryStore } from './mastery-store'
import type { StudiedCourse } from './course-standing'

// Stored mastery is only right while it is recomputed on every change to its inputs (ADR 0008).
// A student's own evidence is recomputed by the turn handler; this is the other trigger: a change
// to the course itself, which reaches every student enrolled in it at once.
export interface MasteryRecalculationSources {
  // The course as it now is, threshold included, read after the change has landed.
  course: (courseId: string) => Promise<StudiedCourse>
  enrolledStudentIds: (courseId: string) => Promise<string[]>
  // The student-data stores of the course being recomputed, so a change to one course
  // never reads or writes the rows of another.
  evidence: (courseId: string) => EvidenceStore
  mastery: (courseId: string) => MasteryStore
}

export interface MasteryRecalculator {
  forCourse: (courseId: string) => Promise<void>
}

export function createMasteryRecalculator(sources: MasteryRecalculationSources): MasteryRecalculator {
  return {
    async forCourse(courseId) {
      const course = await sources.course(courseId)
      const evidence = sources.evidence(courseId)
      const mastery = sources.mastery(courseId)
      for (const studentId of await sources.enrolledStudentIds(courseId)) {
        await saveMasteryFromEvidence(course, await evidence.forStudent(studentId), studentId, mastery)
      }
    },
  }
}
