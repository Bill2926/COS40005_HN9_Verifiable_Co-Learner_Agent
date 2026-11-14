import { describe, expect, it, vi } from 'vitest'
import { handleLecturer } from '../server/lecturer/handle-lecturer'
import { createMemoryLecturerStore } from '../server/storage/lecturer-store'

const lecturerEmails = 'other@example.com, LECTURER@example.com'
const title = 'Introduction to Programming with Python'
const seeded = { action: 'seeded' as const, actorEmail: 'lecturer@example.com', time: '2026-11-14T08:00:00Z' }

describe('lecturer handler', () => {
  it.each([
    { email: null, statusCode: 401 },
    { email: 'an@example.com', statusCode: 403 },
    { email: 'owner@example.com', statusCode: 403 },
  ])('returns $statusCode for $email before reading courses', async ({ email, statusCode }) => {
    const store = { forLecturer: vi.fn() }
    await expect(handleLecturer({ email, lecturerEmails, store })).rejects.toMatchObject({ statusCode })
    expect(store.forLecturer).not.toHaveBeenCalled()
  })

  it('shows the demo lecturer two enrollments and the seeded history for their course only', async () => {
    const store = createMemoryLecturerStore([
      { ownerEmail: 'lecturer@example.com', id: 'intro_python', title, enrolledCount: 2, history: [seeded] },
      { ownerEmail: 'other@example.com', id: 'other', title: 'Other course', enrolledCount: 4, history: [] },
    ])

    await expect(handleLecturer({ email: 'Lecturer@example.com', lecturerEmails, store })).resolves.toEqual({
      courses: [{ id: 'intro_python', title, enrolledCount: 2, history: [seeded] }],
    })
  })
})
