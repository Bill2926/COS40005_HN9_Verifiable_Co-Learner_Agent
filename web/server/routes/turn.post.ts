import { sessionStudentId } from '../../shared/student-id'
import { handleTurn } from '../turn/handle-turn'

export default defineEventHandler(async (event) => {
  const studentId = await sessionStudentId(event)
  if (!studentId) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  return handleTurn({
    sessionStudentId: studentId,
    body: await readBody(event),
  })
})
