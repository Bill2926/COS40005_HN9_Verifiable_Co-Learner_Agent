import { describe, expect, it, vi } from 'vitest'
import { handleCourseSpec, handleLecturer } from '../server/lecturer/handle-lecturer'
import { pythonCourseSpec } from '../server/course'
import { createMemoryLecturerStore } from '../server/storage/lecturer-store'

const lecturerEmails = 'other@example.com, LECTURER@example.com'
const title = 'Introduction to Programming with Python'
const seeded = { action: 'seeded' as const, actorEmail: 'lecturer@example.com', time: '2026-11-14T08:00:00Z' }
const students = [
  { displayName: 'An', studentNumber: 'SWB0001', email: 'an@example.com', enrolledAt: '2026-11-14T08:00:00Z' },
  { displayName: 'Bình', studentNumber: 'SWB0002', email: 'binh@example.com', enrolledAt: '2026-11-14T08:05:00Z' },
]
const python = {
  ownerEmail: 'lecturer@example.com',
  id: 'intro_python',
  title,
  enrolledCount: 2,
  masteryThreshold: 0.9,
  history: [seeded],
  students,
}

describe('lecturer handler', () => {
  it.each([
    { email: null, statusCode: 401 },
    { email: 'an@example.com', statusCode: 403 },
    { email: 'owner@example.com', statusCode: 403 },
  ])('returns $statusCode for $email before reading courses', async ({ email, statusCode }) => {
    const store = { forLecturer: vi.fn(), setThreshold: vi.fn() }
    await expect(handleLecturer({ email, lecturerEmails, store })).rejects.toMatchObject({ statusCode })
    expect(store.forLecturer).not.toHaveBeenCalled()
  })

  it('shows the demo lecturer two enrollments, their students and the seeded history for their course only', async () => {
    const store = createMemoryLecturerStore([
      python,
      {
        ownerEmail: 'other@example.com',
        id: 'other',
        title: 'Other course',
        enrolledCount: 1,
        masteryThreshold: 0.9,
        history: [],
        students: [{ displayName: 'Elsewhere', studentNumber: 'SWB0009', email: 'else@example.com', enrolledAt: '2026-11-14T09:00:00Z' }],
      },
    ])

    await expect(handleLecturer({ email: 'Lecturer@example.com', lecturerEmails, store })).resolves.toEqual({
      courses: [{ id: 'intro_python', title, enrolledCount: 2, masteryThreshold: 0.9, history: [seeded], students }],
    })
  })

  it.each([0.49, 1, NaN, '0.8'])('rejects invalid threshold %s before writing', async (threshold) => {
    const store = { forLecturer: vi.fn(), setThreshold: vi.fn() }
    await expect(handleLecturer({ email: 'lecturer@example.com', lecturerEmails, store, change: { courseId: python.id, threshold } }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(store.setThreshold).not.toHaveBeenCalled()
  })

  it('records one history entry for a change and rejects another lecturer changing it', async () => {
    const store = createMemoryLecturerStore([python])
    const request = { email: 'lecturer@example.com', lecturerEmails, store, change: { courseId: python.id, threshold: 0.99 } }
    await expect(handleLecturer({ ...request, email: 'other@example.com' })).rejects.toMatchObject({ statusCode: 404 })
    await handleLecturer(request)
    const { courses } = await handleLecturer(request)
    expect(courses[0]?.masteryThreshold).toBe(0.99)
    expect(courses[0]?.history).toEqual([
      { action: 'mastery_threshold_changed', actorEmail: request.email, previousThreshold: 0.9, masteryThreshold: 0.99, time: expect.any(String) },
      seeded,
    ])
  })
})

describe('lecturer course spec', () => {
  function setup() {
    const store = createMemoryLecturerStore([{ ...python, spec: pythonCourseSpec }])
    const request = { email: 'lecturer@example.com', lecturerEmails, store }
    const download = () => handleCourseSpec({ ...request, action: 'export', courseId: python.id })
    const upload = (spec: unknown) => handleCourseSpec({ ...request, action: 'import', json: JSON.stringify(spec) })
    return { request, download, upload }
  }

  it('exports the running content and preserves it on a round trip', async () => {
    const { download, upload, request } = setup()
    const exported = await download()
    expect(exported).toEqual(pythonCourseSpec)
    await upload(exported)
    expect(await download()).toEqual(exported)
    const { courses } = await handleLecturer(request)
    expect(courses[0]?.history[0]).toMatchObject({ action: 'course_spec_imported', actorEmail: request.email })
    expect(JSON.stringify(courses)).not.toContain('referenceSolution')
  })

  it('replaces content on a valid import', async () => {
    const { download, upload } = setup()
    const updated = { ...pythonCourseSpec, title: 'Python Foundations' }
    await upload(updated)
    expect(await download()).toEqual(updated)
  })

  it.each([
    { ...pythonCourseSpec, courseId: 'other' },
    { ...pythonCourseSpec, modules: [{ ...pythonCourseSpec.modules[0], content: { materials: {} } }] },
  ])('refuses incompatible files without editing the course', async (invalid) => {
    const { download, upload, request } = setup()
    await expect(upload(invalid)).rejects.toMatchObject({ statusCode: 400 })
    expect(await download()).toEqual(pythonCourseSpec)
    expect((await handleLecturer(request)).courses[0]?.history).toEqual([seeded])
  })

  it.each([
    { email: null, statusCode: 401 },
    { email: 'an@example.com', statusCode: 403 },
    { email: 'other@example.com', statusCode: 404 },
  ])('refuses export and import for $email', async ({ email, statusCode }) => {
    const { request } = setup()
    await expect(handleCourseSpec({ ...request, email, action: 'export', courseId: python.id }))
      .rejects.toMatchObject({ statusCode })
    await expect(handleCourseSpec({ ...request, email, action: 'import', json: JSON.stringify(pythonCourseSpec) }))
      .rejects.toMatchObject({ statusCode })
  })
})
