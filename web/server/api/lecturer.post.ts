import { sessionEmail } from '../../shared/student-id'
import { handleLecturer } from '../lecturer/handle-lecturer'
import { createSupabaseLecturerStore } from '../storage/supabase-lecturer-store'
import { createSupabaseMasteryRecalculator } from '../storage/supabase-mastery-recalculation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const connection = { url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }
  return handleLecturer({
    email: await sessionEmail(event),
    lecturerEmails: config.lecturerEmails,
    store: createSupabaseLecturerStore(connection),
    change: await readBody(event) ?? null,
    // A new threshold judges every student's stored mastery against a different mark (ADR 0008).
    recalculate: createSupabaseMasteryRecalculator(connection),
  })
})
