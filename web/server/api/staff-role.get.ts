import { staffSessionEmail } from '../auth/staff-session-email'
import { staffRole } from '../staff/staff-role'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  return staffRole({
    email: await staffSessionEmail(event),
    adminEmails: config.adminEmails,
    lecturerEmails: config.lecturerEmails,
  })
})
