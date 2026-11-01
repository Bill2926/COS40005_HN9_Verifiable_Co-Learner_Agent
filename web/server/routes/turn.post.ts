import { sessionStudentId } from '../auth/session'
import { handleTurn, SignInRequiredError } from '../turn/handle-turn'

export default defineEventHandler(async (event) => {
  const studentId = await sessionStudentId(event)
  if (!studentId) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  const body = await readBody(event)
  try {
    return handleTurn({
      sessionStudentId: studentId,
      body,
    })
  }
  catch (error) {
    if (error instanceof SignInRequiredError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
