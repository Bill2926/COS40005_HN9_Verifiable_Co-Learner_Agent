import { createClient } from '@supabase/supabase-js'
import type { DeskmateSettingStore } from './deskmate-setting-store'

// Not scoped to a course: the switch is the same in every course.
export function createSupabaseDeskmateSettingStore(options: {
  url: string
  secretKey: string
}): DeskmateSettingStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async read(studentId) {
      const result = await supabase
        .from('deskmate_settings')
        .select('enabled')
        .eq('student_id', studentId)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      return result.data ? result.data.enabled : true
    },
    async save(studentId, on) {
      const result = await supabase.from('deskmate_settings').upsert({
        student_id: studentId,
        enabled: on,
      }, { onConflict: 'student_id' })
      if (result.error) throw new Error(result.error.message)
    },
  }
}
