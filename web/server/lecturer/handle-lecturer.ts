import type { LecturerResponse } from '../../shared/lecturer'
import type { LecturerStore } from '../storage/lecturer-store'

export async function handleLecturer(request: {
  email: string | null
  lecturerEmails: string
  store: LecturerStore
}): Promise<LecturerResponse> {
  const email = request.email?.trim().toLowerCase()
  if (!email) {
    throw Object.assign(new Error('Sign in required'), { statusCode: 401 })
  }
  if (!request.lecturerEmails.split(',').some(allowed => allowed.trim().toLowerCase() === email)) {
    throw Object.assign(new Error('Lecturer access required'), { statusCode: 403 })
  }
  return { courses: await request.store.forLecturer(email) }
}
