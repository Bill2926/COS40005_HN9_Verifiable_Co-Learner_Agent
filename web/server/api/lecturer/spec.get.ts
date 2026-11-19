import { staffSessionEmail } from '../../auth/staff-session-email'
import { handleCourseSpec } from '../../lecturer/handle-lecturer'
import { createSupabaseLecturerStore } from '../../storage/supabase-lecturer-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const identity = {
    courseId: query.courseId,
    email: await staffSessionEmail(event),
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
  if (query.draft === '1' && query.download === '1' && spec === null) {
    throw createError({ statusCode: 404, statusMessage: 'There is no draft to export.' })
  }
  if (query.draft !== '1' || query.download === '1') {
    const name = query.draft === '1' ? 'intro_python-draft.json' : 'intro_python.json'
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${name}"`)
  }
  return JSON.stringify(spec, null, 2) + '\n'
})
