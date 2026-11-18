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
  evidence: EvidenceStore
  mastery: MasteryStore
}

export interface MasteryRecalculator {
  forCourse: (courseId: string) => Promise<void>
}

export function createMasteryRecalculator(sources: MasteryRecalculationSources): MasteryRecalculator {
  return {
    async forCourse(courseId) {
      const course = await sources.course(courseId)
      for (const studentId of await sources.enrolledStudentIds(courseId)) {
        await saveMasteryFromEvidence(course, await sources.evidence.forStudent(studentId), studentId, sources.mastery)
      }
    },
  }
}
