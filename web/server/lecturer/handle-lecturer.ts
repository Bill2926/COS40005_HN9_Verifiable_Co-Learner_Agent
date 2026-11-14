import type { LecturerResponse } from '../../shared/lecturer'
import { defaultCourseId, parseCourseSpec, type CourseSpec } from '../course'
import type { LecturerStore } from '../storage/lecturer-store'

interface LecturerIdentity {
  email: string | null
  lecturerEmails: string
}

function requireLecturer(request: LecturerIdentity): string {
  const email = request.email?.trim().toLowerCase()
  if (!email) {
    throw Object.assign(new Error('Sign in required'), { statusCode: 401 })
  }
  if (!request.lecturerEmails.split(',').some(allowed => allowed.trim().toLowerCase() === email)) {
    throw Object.assign(new Error('Lecturer access required'), { statusCode: 403 })
  }
  return email
}

export async function handleLecturer(request: LecturerIdentity & {
  store: Pick<LecturerStore, 'forLecturer' | 'setThreshold'>
  change?: unknown
}): Promise<LecturerResponse> {
  const email = requireLecturer(request)
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

interface CourseSpecRequest extends LecturerIdentity {
  store: Pick<LecturerStore, 'exportSpec' | 'importSpec'>
}

export function handleCourseSpec(request: CourseSpecRequest & { action: 'export', courseId: unknown }): Promise<CourseSpec>
export function handleCourseSpec(request: CourseSpecRequest & { action: 'import', json: unknown }): Promise<void>
export async function handleCourseSpec(request: CourseSpecRequest
  & ({ action: 'export', courseId: unknown } | { action: 'import', json: unknown })): Promise<CourseSpec | void> {
  const email = requireLecturer(request)
  if (request.action === 'export') {
    if (request.courseId === defaultCourseId) {
      const spec = await request.store.exportSpec(email, defaultCourseId)
      if (spec) return spec
    }
  }
  else {
    let spec: CourseSpec
    try {
      if (typeof request.json !== 'string') throw new Error('Expected JSON')
      spec = parseCourseSpec(request.json)
    }
    catch {
      throw Object.assign(new Error('Invalid course spec JSON.'), { statusCode: 400 })
    }
    if (spec.courseId !== defaultCourseId) {
      throw Object.assign(new Error('The course spec must be for the Python course.'), { statusCode: 400 })
    }
    if (await request.store.importSpec(email, spec)) return
  }
  throw Object.assign(new Error('Course not found.'), { statusCode: 404 })
}
