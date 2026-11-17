// Staff are never students. Lecturer status is checked through the lecturer
// endpoint and product-owner status through the cheap admin role check.
type Fetcher = (url: string, options?: { method: 'POST', body: Record<string, string> }) => Promise<unknown>

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

// Where signing in sends a member of staff, or null for a student. The product
// owner wins, so a person with both roles lands in the admin pages.
export async function staffLanding(fetcher: Fetcher): Promise<'/admin' | '/lecturer' | null> {
  const [productOwner, lecturer] = await Promise.all([isProductOwner(fetcher), isLecturer(fetcher)])
  if (productOwner) return '/admin'
  return lecturer ? '/lecturer' : null
}
