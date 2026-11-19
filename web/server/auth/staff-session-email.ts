import type { H3Event } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { sessionStudentId } from '../../shared/student-id'
import { staffEmailFromUserId } from './staff-email'

// Staff routes call this instead of the JWT email claim. The id comes from the
// signed session; the email comes back from Auth through the secret key. A
// missing key or a failed read grants no role.
export async function staffSessionEmail(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig(event)
  const url = config.public.supabaseUrl
  const secretKey = config.supabaseSecretKey
  if (!url || !secretKey) return null

  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return staffEmailFromUserId({
    userId: await sessionStudentId(event),
    readUser: async (userId) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(userId)
        if (error || !data.user) return null
        return {
          email: data.user.email,
          emailConfirmedAt: data.user.email_confirmed_at,
          userMetadata: data.user.user_metadata,
        }
      }
      catch {
        return null
      }
    },
  })
}
