import { describe, expect, it, vi } from 'vitest'
import { isLecturer, isProductOwner, staffLanding } from '../app/staff/landing'
import { staffRole } from '../server/staff/staff-role'

function fetcherFor(role: { productOwner: boolean, lecturer: boolean }) {
  return vi.fn(async (url: string) => {
    if (url === '/api/staff-role') return role
    throw new Error(`Unexpected request to ${url}`)
  })
}

describe('staff landing', () => {
  it('sends a product owner to the admin pages, even when they also lecture', async () => {
    await expect(staffLanding(fetcherFor({ productOwner: true, lecturer: true }))).resolves.toBe('/admin')
  })

  it('sends a lecturer to the lecturer page', async () => {
    await expect(staffLanding(fetcherFor({ productOwner: false, lecturer: true }))).resolves.toBe('/lecturer')
  })

  it('leaves a student on the course', async () => {
    await expect(staffLanding(fetcherFor({ productOwner: false, lecturer: false }))).resolves.toBeNull()
  })

  it('asks the server once, not once per role', async () => {
    const fetcher = fetcherFor({ productOwner: false, lecturer: true })
    await staffLanding(fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reads each role on its own', async () => {
    const fetcher = fetcherFor({ productOwner: false, lecturer: true })
    await expect(isProductOwner(fetcher)).resolves.toBe(false)
    await expect(isLecturer(fetcher)).resolves.toBe(true)
  })

  it('treats a failed role request as a student', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(staffLanding(failing)).resolves.toBeNull()
  })
})

describe('staff role answer', () => {
  const lists = { adminEmails: 'owner@x.edu', lecturerEmails: 'Lee@x.edu, other@x.edu' }

  it('answers neither role for a student, without refusing', () => {
    expect(staffRole({ email: 'student@x.edu', ...lists })).toEqual({ productOwner: false, lecturer: false })
  })

  it('answers neither role when there is no session', () => {
    expect(staffRole({ email: null, ...lists })).toEqual({ productOwner: false, lecturer: false })
  })

  it('reads each allowlist, ignoring case and spaces', () => {
    expect(staffRole({ email: 'lee@x.edu', ...lists })).toEqual({ productOwner: false, lecturer: true })
    expect(staffRole({ email: ' OWNER@x.edu ', ...lists })).toEqual({ productOwner: true, lecturer: false })
    expect(staffRole({ email: 'owner@x.edu', adminEmails: 'owner@x.edu', lecturerEmails: 'owner@x.edu' }))
      .toEqual({ productOwner: true, lecturer: true })
  })
})
