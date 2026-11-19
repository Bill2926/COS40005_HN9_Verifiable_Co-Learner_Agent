// The user record a staff route may see. Only the stored email and its
// confirmation time count. userMetadata is editable by the signed-in person,
// so it is not a source of a staff role.
export interface StaffUserRecord {
  email?: string | null
  emailConfirmedAt?: string | null
  userMetadata?: unknown
}

// The only email a staff route may trust. `body` is accepted so a route can
// hand the request over whole, and it is never read: a student can put a staff
// email or a role in the body, and that must not grant one.
export function emailForStaffRoute(source: {
  user: StaffUserRecord | null
  body?: unknown
}): string | null {
  const confirmedAt = source.user?.emailConfirmedAt
  if (typeof confirmedAt !== 'string' || confirmedAt.trim() === '') return null
  const email = source.user?.email?.trim() ?? ''
  return email === '' ? null : email
}

// Reads the user record for the session's own id. An id in the body is not
// the session, so it is not the id that is read.
export async function staffEmailFromUserId(source: {
  userId: string | null
  readUser: (userId: string) => Promise<StaffUserRecord | null>
  body?: unknown
}): Promise<string | null> {
  if (!source.userId) return null
  const user = await source.readUser(source.userId)
  return emailForStaffRoute({ user, body: source.body })
}
