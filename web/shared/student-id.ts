import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { createRequestClient } from './supabase-server'

export async function studentIdFromAuth(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims.sub) return null
    return data.claims.sub
  }
  catch {
    return null
  }
}

export async function sessionStudentId(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const publishableKey = config.public.supabasePublishableKey
  if (!url || !publishableKey) return null

  return studentIdFromAuth(createRequestClient(event, url, publishableKey))
}
