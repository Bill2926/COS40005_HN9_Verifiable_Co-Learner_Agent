import type { StaffRole } from '../../shared/staff-role'
import { isProductOwner } from '../admin/handle-admin'
import { isLecturer } from '../lecturer/handle-lecturer'

// Answers who the caller is and reads nothing. A student, or a caller with no
// session, is a normal answer (neither role), not a refusal, so the landing
// check on every student page does not raise a 403 in the server log.
export function staffRole(request: {
  email: string | null
  adminEmails: string
  lecturerEmails: string
}): StaffRole {
  const email = request.email?.trim() ?? ''
  if (email === '') return { productOwner: false, lecturer: false }
  return {
    productOwner: isProductOwner(email, request.adminEmails),
    lecturer: isLecturer(email, request.lecturerEmails),
  }
}
