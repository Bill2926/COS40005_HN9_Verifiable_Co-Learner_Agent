// Staff are never students. Lecturer status is checked through the lecturer
// endpoint and product-owner status through the cheap admin role check.
type Fetcher = (url: string, options?: { method: 'POST', body: Record<string, string> }) => Promise<unknown>

export interface StaffRoles {
  productOwner: boolean
  lecturer: boolean
}

export async function isProductOwner(fetcher: Fetcher): Promise<boolean> {
  try {
    await fetcher('/api/admin', { method: 'POST', body: { event: 'role' } })
    return true
  }
  catch {
    return false
  }
}

export async function isLecturer(fetcher: Fetcher): Promise<boolean> {
  try {
    await fetcher('/api/lecturer')
    return true
  }
  catch {
    return false
  }
}

// Both checks at once, for the switch between the staff pages.
export async function staffRoles(fetcher: Fetcher): Promise<StaffRoles> {
  const [productOwner, lecturer] = await Promise.all([isProductOwner(fetcher), isLecturer(fetcher)])
  return { productOwner, lecturer }
}

// Where signing in sends a member of staff, or null for a student. The product
// owner is checked first, so a person with both roles lands in the admin pages.
export async function staffLanding(fetcher: Fetcher): Promise<'/admin' | '/lecturer' | null> {
  if (await isProductOwner(fetcher)) return '/admin'
  if (await isLecturer(fetcher)) return '/lecturer'
  return null
}
