import { sessionEmail } from '../../../shared/student-id'
import { handleCourseSpec } from '../../lecturer/handle-lecturer'
import { createSupabaseLecturerStore } from '../../storage/supabase-lecturer-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const identity = {
    courseId: query.courseId,
    email: await sessionEmail(event),
    lecturerEmails: config.lecturerEmails,
    store: createSupabaseLecturerStore({ url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }),
  }
  if (query.preview === '1') {
    return handleCourseSpec({ ...identity, action: 'preview' })
  }
  const spec = query.draft === '1'
    ? await handleCourseSpec({ ...identity, action: 'draft' })
    : await handleCourseSpec({ ...identity, action: 'export' })
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  if (query.draft !== '1') {
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="intro_python.json"')
  }
  return JSON.stringify(spec, null, 2) + '\n'
})
