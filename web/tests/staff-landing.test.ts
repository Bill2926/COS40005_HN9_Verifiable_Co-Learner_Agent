import { describe, expect, it, vi } from 'vitest'
import { isLecturer, isProductOwner, staffLanding, staffRoles } from '../app/staff/landing'

function fetcherFor({ productOwner, lecturer }: { productOwner: boolean, lecturer: boolean }) {
  return vi.fn(async (url: string) => {
    if (url === '/api/lecturer') {
      if (!lecturer) throw new Error('Lecturer access required')
      return { courses: [] }
    }
    if (url === '/api/admin') {
      if (!productOwner) throw new Error('Product owner access required')
      return { productOwner: true }
    }
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

  it('still finds the lecturer when the product-owner check fails', async () => {
    const fetcher = fetcherFor({ productOwner: false, lecturer: true })
    await expect(isProductOwner(fetcher)).resolves.toBe(false)
    await expect(isLecturer(fetcher)).resolves.toBe(true)
  })

  it('reports both staff roles so a person with both gets the switch', async () => {
    await expect(staffRoles(fetcherFor({ productOwner: true, lecturer: true })))
      .resolves.toEqual({ productOwner: true, lecturer: true })
    await expect(staffRoles(fetcherFor({ productOwner: true, lecturer: false })))
      .resolves.toEqual({ productOwner: true, lecturer: false })
  })
})
