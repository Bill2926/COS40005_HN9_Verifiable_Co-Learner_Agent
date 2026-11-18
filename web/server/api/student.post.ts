import { sessionEmail, sessionStudentId } from '../../shared/student-id'
import { createSupabaseActivityLog } from '../storage/supabase-activity-log'
import { createSupabaseCourseStore } from '../storage/supabase-course-store'
import { createSupabaseMindmapStore } from '../storage/supabase-mindmap-store'
import { createSupabaseProfileStore } from '../storage/supabase-profile-store'
import { createSupabaseStudentFileStore } from '../storage/supabase-student-file-store'
import { defaultCourseId } from '../course'
import { CampusRequiredError, handleStudent, SignInRequiredError, StudentRequestError } from '../student'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig()
  const connection = { url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }
  try {
    const [studentId, email, course] = await Promise.all([
      sessionStudentId(event),
      sessionEmail(event),
      createSupabaseCourseStore(connection).course(defaultCourseId),
    ])
    return await handleStudent({
      sessionStudentId: studentId,
      email,
      courseId: defaultCourseId,
      moduleIds: course.modules.map(module => module.id),
      body: await readBody(event),
      activity: createSupabaseActivityLog(connection),
      profile: createSupabaseProfileStore(connection),
      mindmap: createSupabaseMindmapStore(connection),
      files: createSupabaseStudentFileStore(connection),
    })
  }
  catch (error) {
    if (error instanceof SignInRequiredError || error instanceof CampusRequiredError || error instanceof StudentRequestError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
