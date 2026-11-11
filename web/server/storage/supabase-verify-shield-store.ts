import { createClient } from '@supabase/supabase-js'
import type { VerifyShieldStore } from './verify-shield-store'

export function createSupabaseVerifyShieldStore(options: {
  url: string
  secretKey: string
}): VerifyShieldStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async read() {
      const result = await supabase
        .from('verify_shield_settings')
        .select('enabled')
        .eq('id', 1)
        .maybeSingle()
      if (result.error || !result.data) return null
      return result.data.enabled
    },
    async save(enabled) {
      const result = await supabase.from('verify_shield_settings').upsert({
        id: 1,
        enabled,
      }, { onConflict: 'id' })
      if (result.error) throw new Error(result.error.message)
    },
  }
}
