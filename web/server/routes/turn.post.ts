import { sessionStudentId } from '../../shared/student-id'
import { agentsForTurn } from '../agents'
import { createSupabaseConversationStore } from '../storage/supabase-conversation-store'
import { createSupabaseDecisionLogStore } from '../storage/supabase-decision-log'
import { createSupabaseEvidenceStore } from '../storage/supabase-evidence-store'
import { createSupabaseQuizAnswerStore } from '../storage/supabase-quiz-answer-store'
import { createSupabaseModelSettingsStore } from '../storage/supabase-model-settings-store'
import { createSupabaseVerifyShieldStore } from '../storage/supabase-verify-shield-store'
import { verifyShieldForTurn } from '../verify-shield'
import { handleTurn, streamTurn, UnknownExerciseError } from '../turn/handle-turn'

export default defineEventHandler(async (event) => {
  const studentId = await sessionStudentId(event)
  if (!studentId) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  const config = useRuntimeConfig()
  const connection = {
    url: config.public.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  }
  const store = createSupabaseConversationStore(connection)
  const body = await readBody(event)
  const request = { sessionStudentId: studentId, body }
  // Opening a module does not call the model. Skip those reads so the click
  // is not waiting on settings it will never use.
  const navigation = isNavigationTurn(body)
  const [agents, verifyShieldOn] = navigation
    ? [undefined, true] as const
    : await Promise.all([
        agentsForTurn(createSupabaseModelSettingsStore(connection), {
          provider: config.model,
          apiKey: config.modelApiKey,
          baseUrl: config.modelBaseUrl,
          modelName: config.modelName,
        }),
        verifyShieldForTurn(
          createSupabaseVerifyShieldStore(connection),
          config.verifyShield,
        ),
      ])
  const options = {
    verifyShieldOn,
    decisions: createSupabaseDecisionLogStore(connection),
    evidence: createSupabaseEvidenceStore(connection),
    quizAnswers: createSupabaseQuizAnswerStore(connection),
  }

  try {
    if (!isStreamedTurn(body)) return await handleTurn(request, store, agents, options)

    setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
    setResponseHeader(event, 'cache-control', 'no-cache, no-transform')
    setResponseHeader(event, 'x-accel-buffering', 'no')
    const encoder = new TextEncoder()
    const turns = streamTurn(request, store, agents, options)
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await turns.next()
          if (next.done) {
            controller.close()
            return
          }
          controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`))
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

function isNavigationTurn(input: unknown): boolean {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && (input.event === 'select_module' || input.event === 'select_exercise' || input.event === 'preview_module' || input.event === 'quiz_answer')
}
