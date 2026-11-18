import { createMasteryRecalculator, type MasteryRecalculator } from '../student-model'
import { createSupabaseCourseStore } from './supabase-course-store'
import { createSupabaseEnrollmentStore } from './supabase-enrollment-store'
import { createSupabaseEvidenceStore } from './supabase-evidence-store'
import { createSupabaseMasteryStore } from './supabase-mastery-store'

// A change to the course itself recomputes every enrolled student's stored mastery over their own
// evidence (ADR 0008). Both lecturer routes read the course from the database, so they build it here.
export function createSupabaseMasteryRecalculator(connection: {
  url: string
  secretKey: string
}): MasteryRecalculator {
  const courses = createSupabaseCourseStore(connection)
  const enrollments = createSupabaseEnrollmentStore(connection)
  const studentData = (courseId: string) => ({ ...connection, courseId })
  return createMasteryRecalculator({
    // Read after the change has landed, so the new threshold and modules are the ones estimated with.
    course: (id) => courses.course(id),
    enrolledStudentIds: (id) => enrollments.enrolledStudentIds(id),
    evidence: (id) => createSupabaseEvidenceStore(studentData(id)),
    mastery: (id) => createSupabaseMasteryStore(studentData(id)),
  })
}
