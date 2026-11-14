import type { LecturerResponse } from '../../shared/lecturer'
import type { LecturerStore } from '../storage/lecturer-store'

export async function handleLecturer(request: {
  email: string | null
  lecturerEmails: string
  store: LecturerStore
  change?: unknown
}): Promise<LecturerResponse> {
  const email = request.email?.trim().toLowerCase()
  if (!email) {
    throw Object.assign(new Error('Sign in required'), { statusCode: 401 })
  }
  if (!request.lecturerEmails.split(',').some(allowed => allowed.trim().toLowerCase() === email)) {
    throw Object.assign(new Error('Lecturer access required'), { statusCode: 403 })
  }
  if (request.change !== undefined) {
    const change = request.change
    if (typeof change !== 'object' || change === null
      || !('courseId' in change) || typeof change.courseId !== 'string' || !change.courseId.trim()
      || !('threshold' in change) || typeof change.threshold !== 'number'
      || !Number.isFinite(change.threshold) || change.threshold < 0.5 || change.threshold > 0.99) {
      throw Object.assign(new Error('Mastery threshold must be between 0.5 and 0.99 for an owned course'), { statusCode: 400 })
    }
    if (!(await request.store.setThreshold(email, change.courseId, change.threshold))) {
      throw Object.assign(new Error('Course not found'), { statusCode: 404 })
    }
  }
  return { courses: await request.store.forLecturer(email) }
}
