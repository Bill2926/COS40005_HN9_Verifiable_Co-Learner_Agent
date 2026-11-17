import type { StaffRole } from '../../shared/staff-role'

// Staff are never students. One request to the role endpoint says which staff
// roles the person holds. It answers 200 for a student too, so a student's
// page loads leave no error behind.
type Fetcher = (url: string) => Promise<unknown>

const none: StaffRole = { productOwner: false, lecturer: false }

export async function staffRole(fetcher: Fetcher): Promise<StaffRole> {
  try {
    const role = await fetcher('/api/staff-role') as Partial<StaffRole>
    return { productOwner: role.productOwner === true, lecturer: role.lecturer === true }
  }
  catch {
    return none
  }
}

export async function isProductOwner(fetcher: Fetcher): Promise<boolean> {
  return (await staffRole(fetcher)).productOwner
}

export async function isLecturer(fetcher: Fetcher): Promise<boolean> {
  return (await staffRole(fetcher)).lecturer
}

// Where signing in sends a member of staff, or null for a student. The product
// owner wins, so a person with both roles lands in the admin pages.
export async function staffLanding(fetcher: Fetcher): Promise<'/admin' | '/lecturer' | null> {
  const role = await staffRole(fetcher)
  if (role.productOwner) return '/admin'
  return role.lecturer ? '/lecturer' : null
}
