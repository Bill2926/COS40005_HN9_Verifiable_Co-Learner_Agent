import { describe, expect, it, vi } from 'vitest'
import { handleLecturer } from '../server/lecturer/handle-lecturer'
import { createMemoryLecturerStore } from '../server/storage/lecturer-store'

const lecturerEmails = 'other@example.com, LECTURER@example.com'
const title = 'Introduction to Programming with Python'
const seeded = { action: 'seeded' as const, actorEmail: 'lecturer@example.com', time: '2026-11-14T08:00:00Z' }
const python = { ownerEmail: 'lecturer@example.com', id: 'intro_python', title, enrolledCount: 2, masteryThreshold: 0.9, history: [seeded] }

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

  it('shows the demo lecturer two enrollments and the seeded history for their course only', async () => {
    const store = createMemoryLecturerStore([
      python,
      { ownerEmail: 'other@example.com', id: 'other', title: 'Other course', enrolledCount: 4, masteryThreshold: 0.9, history: [] },
    ])

    await expect(handleLecturer({ email: 'Lecturer@example.com', lecturerEmails, store })).resolves.toEqual({
      courses: [{ id: 'intro_python', title, enrolledCount: 2, masteryThreshold: 0.9, history: [seeded] }],
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
