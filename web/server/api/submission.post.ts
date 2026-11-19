import { sessionStudentId } from '../../shared/student-id'
import { defaultCourseId } from '../course'
import { createSupabaseSubmissionStore } from '../storage/supabase-submission-store'
import { SubmissionNotFoundError, SubmissionRefusedError } from '../storage/submission-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const studentId = await sessionStudentId(event)
  if (!studentId) throw createError({ statusCode: 401, statusMessage: 'Sign in required' })

  const config = useRuntimeConfig()
  const store = createSupabaseSubmissionStore({
    url: config.public.supabaseUrl,
    secretKey: config.supabaseSecretKey,
    courseId: defaultCourseId,
  })
  const body = await readBody(event)
  const id = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string'
    ? body.id
    : null
  try {
    if (!id) return { submissions: await store.forStudent(studentId) }
    return { submission: await store.read(studentId, id) }
  }
  catch (error) {
    if (error instanceof SubmissionRefusedError || error instanceof SubmissionNotFoundError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
