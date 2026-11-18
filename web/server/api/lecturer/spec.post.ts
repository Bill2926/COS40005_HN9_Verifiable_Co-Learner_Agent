import { sessionEmail } from '../../../shared/student-id'
import { defaultCourseId } from '../../course'
import { handleCourseSpec } from '../../lecturer/handle-lecturer'
import { createSupabaseLecturerStore } from '../../storage/supabase-lecturer-store'
import { createSupabaseMasteryRecalculator } from '../../storage/supabase-mastery-recalculation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const raw = await readRawBody(event)
  const connection = { url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }
  const store = createSupabaseLecturerStore(connection)
  // A published spec may change the modules, exercises and questions the evidence is about, so
  // every enrolled student's stored mastery is recomputed from it (ADR 0008).
  const recalculate = createSupabaseMasteryRecalculator(connection)
  const identity = { email: await sessionEmail(event), lecturerEmails: config.lecturerEmails, store, recalculate }
  const command = commandFrom(raw)
  if (command.action === 'publish' || command.action === 'discard') {
    await handleCourseSpec({ ...identity, action: command.action, courseId: defaultCourseId })
  }
  else {
    await handleCourseSpec({ ...identity, action: command.action, json: command.json })
  }
  return sendNoContent(event)
})

function commandFrom(raw: string | undefined): { action: 'import' | 'save' | 'publish' | 'discard', json?: string } {
  if (!raw) return { action: 'import', json: raw }
  try {
    const parsed = JSON.parse(raw) as { event?: unknown, spec?: unknown }
    if (parsed.event === 'publish') return { action: 'publish' }
    if (parsed.event === 'discard') return { action: 'discard' }
    if (parsed.event === 'save') return { action: 'save', json: JSON.stringify(parsed.spec) }
  }
  catch {
    return { action: 'import', json: raw }
  }
  return { action: 'import', json: raw }
}
