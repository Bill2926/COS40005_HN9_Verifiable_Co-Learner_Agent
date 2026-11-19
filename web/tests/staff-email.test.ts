import { describe, expect, it, vi } from 'vitest'
import { staffRole } from '../server/staff/staff-role'
import { emailForStaffRoute, staffEmailFromUserId } from '../server/auth/staff-email'

const lists = { adminEmails: 'owner@example.com', lecturerEmails: 'lecturer@example.com' }
const confirmedAt = '2026-11-01T00:00:00.000Z'

describe('staff route email', () => {
  it('accepts a staff role only for a confirmed email on the user record', () => {
    const email = emailForStaffRoute({
      user: { email: ' owner@example.com ', emailConfirmedAt: confirmedAt },
    })

    expect(email).toBe('owner@example.com')
    expect(staffRole({ email, ...lists })).toEqual({ productOwner: true, lecturer: false })
  })

  it('grants nothing when the user record email is not confirmed', () => {
    const email = emailForStaffRoute({
      user: { email: 'lecturer@example.com', emailConfirmedAt: null },
    })

    expect(email).toBeNull()
    expect(staffRole({ email, ...lists })).toEqual({ productOwner: false, lecturer: false })
  })

  it('ignores a staff email in the request body or in editable user metadata', async () => {
    const readUser = vi.fn(async () => ({
      email: 'an@example.com',
      emailConfirmedAt: confirmedAt,
      userMetadata: { email: 'owner@example.com', role: 'admin' },
    }))

    const email = await staffEmailFromUserId({
      userId: 'student-id',
      body: { email: 'lecturer@example.com', role: 'lecturer', userId: 'staff-id' },
      readUser,
    })

    expect(readUser).toHaveBeenCalledTimes(1)
    expect(readUser).toHaveBeenCalledWith('student-id')
    expect(email).toBe('an@example.com')
    expect(staffRole({ email, ...lists })).toEqual({ productOwner: false, lecturer: false })
  })

  it('reads no user when the session has no user id, even if the body names a staff email', async () => {
    const readUser = vi.fn(async () => ({
      email: 'owner@example.com',
      emailConfirmedAt: confirmedAt,
    }))

    const email = await staffEmailFromUserId({
      userId: null,
      body: { email: 'owner@example.com' },
      readUser,
    })

    expect(readUser).not.toHaveBeenCalled()
    expect(email).toBeNull()
    expect(staffRole({ email, ...lists })).toEqual({ productOwner: false, lecturer: false })
  })
})
