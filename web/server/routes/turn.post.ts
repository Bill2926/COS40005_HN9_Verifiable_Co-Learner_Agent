import { sessionStudentId } from '../../shared/student-id'
import { createSupabaseConversationStore } from '../storage/supabase-conversation-store'
import { handleTurn, UnknownExerciseError } from '../turn/handle-turn'

export default defineEventHandler(async (event) => {
  const studentId = await sessionStudentId(event)
  if (!studentId) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  const config = useRuntimeConfig()
  const store = createSupabaseConversationStore({
    url: config.public.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  })

  try {
    return await handleTurn({
      sessionStudentId: studentId,
      body: await readBody(event),
    }, store)
  }
  catch (error) {
    if (error instanceof UnknownExerciseError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
