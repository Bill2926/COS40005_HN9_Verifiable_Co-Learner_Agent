import { sessionEmail } from '../../../shared/student-id'
import { handleCourseSpec } from '../../lecturer/handle-lecturer'
import { createSupabaseLecturerStore } from '../../storage/supabase-lecturer-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const spec = await handleCourseSpec({
    action: 'export',
    courseId: getQuery(event).courseId,
    email: await sessionEmail(event),
    lecturerEmails: config.lecturerEmails,
    store: createSupabaseLecturerStore({ url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }),
  })
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="intro_python.json"')
  return JSON.stringify(spec, null, 2) + '\n'
})
