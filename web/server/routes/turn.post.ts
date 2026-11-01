import { sessionStudentId } from '../../shared/student-id'
import { handleTurn, UnknownExerciseError } from '../turn/handle-turn'

export default defineEventHandler(async (event) => {
  const studentId = await sessionStudentId(event)
  if (!studentId) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  try {
    return handleTurn({
      sessionStudentId: studentId,
      body: await readBody(event),
    })
  }
  catch (error) {
    if (error instanceof UnknownExerciseError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
