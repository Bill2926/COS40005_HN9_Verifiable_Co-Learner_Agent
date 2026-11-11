import { sessionStudentId } from '../../shared/student-id'
import { languageModelForTurn } from '../model/configured-language-model'
import { createSupabaseConversationStore } from '../storage/supabase-conversation-store'
import { createSupabaseModelSettingsStore } from '../storage/supabase-model-settings-store'
import { handleTurn, streamTurn, UnknownExerciseError } from '../turn/handle-turn'

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
  const model = await languageModelForTurn(createSupabaseModelSettingsStore({
    url: config.public.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  }), {
    provider: config.model,
    apiKey: config.modelApiKey,
    baseUrl: config.modelBaseUrl,
    modelName: config.modelName,
  })
  const body = await readBody(event)
  const request = { sessionStudentId: studentId, body }

  try {
    if (!isStreamedTurn(body)) return await handleTurn(request, store, model)

    setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
    setResponseHeader(event, 'cache-control', 'no-cache, no-transform')
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const turnEvent of streamTurn(request, store, model)) {
            controller.enqueue(encoder.encode(`${JSON.stringify(turnEvent)}\n`))
          }
          controller.close()
        }
        catch (error) {
          controller.error(error)
        }
      },
    })
    return sendStream(event, stream)
  }
  catch (error) {
    if (error instanceof UnknownExerciseError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})

function isStreamedTurn(input: unknown): boolean {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && (input.event === 'message' || input.event === 'submission')
}
