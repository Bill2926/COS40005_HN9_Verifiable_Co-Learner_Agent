import { staffSessionEmail } from '../../auth/staff-session-email'
import { handleStaffReview, StaffReviewError } from '../../staff-review'
import { createSupabaseActivityLog } from '../../storage/supabase-activity-log'
import { createSupabaseCourseStore } from '../../storage/supabase-course-store'
import { createSupabaseDecisionLogStore } from '../../storage/supabase-decision-log'
import { createSupabaseEvidenceStore } from '../../storage/supabase-evidence-store'
import { createSupabaseQuizAnswerStore } from '../../storage/supabase-quiz-answer-store'
import { createSupabaseSubmissionStore } from '../../storage/supabase-submission-store'
import { createSupabaseStaffAccessLog } from '../../storage/supabase-staff-access-log'
import { createSupabaseStaffReviewStore } from '../../storage/supabase-staff-review-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const connection = { url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }
  try {
    return await handleStaffReview({
      email: await staffSessionEmail(event),
      adminEmails: config.adminEmails,
      lecturerEmails: config.lecturerEmails,
      studentNumber: String(getQuery(event).studentNumber ?? ''),
      store: createSupabaseStaffReviewStore(connection),
      accessLog: createSupabaseStaffAccessLog(connection),
      courses: createSupabaseCourseStore(connection),
      patternSources: (courseId) => {
        const studentData = { ...connection, courseId }
        return {
          evidence: createSupabaseEvidenceStore(studentData),
          submissions: createSupabaseSubmissionStore(studentData),
          activity: createSupabaseActivityLog(connection),
          decisions: createSupabaseDecisionLogStore(studentData),
          quizAnswers: createSupabaseQuizAnswerStore(studentData),
        }
      },
    })
  }
  catch (error) {
    if (error instanceof StaffReviewError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
