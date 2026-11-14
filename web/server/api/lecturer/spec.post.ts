import { sessionEmail } from '../../../shared/student-id'
import { handleCourseSpec } from '../../lecturer/handle-lecturer'
import { createSupabaseLecturerStore } from '../../storage/supabase-lecturer-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const json = getRequestHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json'
    ? await readRawBody(event)
    : undefined
  await handleCourseSpec({
    action: 'import',
    json,
    email: await sessionEmail(event),
    lecturerEmails: config.lecturerEmails,
    store: createSupabaseLecturerStore({ url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }),
  })
  return sendNoContent(event)
})
