import type { H3Event } from 'h3'
import { createRequestClient } from '../../shared/supabase-server'

export async function sessionStudentId(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const publishableKey = config.public.supabasePublishableKey
  if (!url || !publishableKey) return null

  const supabase = createRequestClient(event, url, publishableKey)
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims.sub) return null
  return data.claims.sub
}
